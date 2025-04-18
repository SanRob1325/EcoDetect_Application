import logging
import time
import requests
from flask import jsonify, request, g
from jose import jwt, jwk
from jose.utils import base64url_decode

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class AuthMiddleware:
    def __init__(self, app, user_pool_id, app_client_id, region="eu-west-1"):

        self.public_endpoints = ['/api/health', '/api/login']
        self.api_key_endpoints = ['/api/sensor-data-upload']
        self.api_keys = self._load_api_keys()
        self.app = app
        self.user_pool_id = user_pool_id
        self.app_client_id = app_client_id
        self.region = region
        self.jwks = None
        self.fetch_jwks()
        
        # Register the before_request handler
        @app.before_request
        def verify_jwt():
            # Skip token verification for login and health check
            if request.method == 'OPTIONS':
                return None
                
            if request.path in ['/api/health', '/api/login']:
                return None
                
            # Get the token from the Authorization header
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                logger.warning(f"Missing or invalid token for path: {request.path}")
                return jsonify({"error": "Unauthorized: Missing or invalid token"}), 401
                
            token = auth_header.split(' ')[1]
            valid, claims = self.verify_token(token)
            
            if not valid:
                logger.warning(f"Invalid token for path: {request.path}")
                return jsonify({"error": "Unauthorized: Invalid token"}), 401
                
            # Store user info in the request context
            g.user = {
                "user_id": claims.get('sub', 'unknown'),
                "email": claims.get('email', 'unknown'),
                "name": claims.get('name', 'User')
            }
            logger.debug(f"Authenticated user {g.user['email']} for {request.path}")
            return None
    
    def fetch_jwks(self):
        """Fetch JSON Web Key Set from Cognito"""
        jwks_url = f"https://cognito-idp.{self.region}.amazonaws.com/{self.user_pool_id}/.well-known/jwks.json"
        try:
            response = requests.get(jwks_url)
            response.raise_for_status()
            self.jwks = response.json()
            
            if 'keys' not in self.jwks:
                logger.error("JWKS response does not contain 'keys'")
                self.jwks = {"keys": []}
                
            logger.info(f"Successfully fetched {len(self.jwks.get('keys', []))} JWKs")
        except Exception as e:
            logger.error(f"Error fetching Cognito JWKS: {str(e)}")
            self.jwks = {"keys": []}
    
    def verify_token(self, token):
        """Verify the Cognito JWT token"""
        # If we don't have keys, try to fetch them again
        if not self.jwks or 'keys' not in self.jwks or not self.jwks['keys']:
            self.fetch_jwks()
            
        try:
            # Get the key id from the token header
            headers = jwt.get_unverified_headers(token)
            kid = headers.get('kid')
            
            if not kid:
                logger.error("Token has no 'kid' in header")
                return False, None
                
            # Find the corresponding key in the JWKs
            key = None
            for k in self.jwks.get('keys', []):
                if k.get('kid') == kid:
                    key = k
                    break
                    
            if not key:
                logger.error(f"No matching key found for kid: {kid}")
                return False, None
                
            # Get public key
            public_key = jwk.construct(key)
            
            # Get message and signature
            message, encoded_signature = token.rsplit('.', 1)
            decoded_signature = base64url_decode(encoded_signature.encode('utf-8'))
            
            # Verify signature
            if not public_key.verify(message.encode('utf-8'), decoded_signature):
                logger.error("Token signature verification failed")
                return False, None
                
            # Get and verify claims
            claims = jwt.get_unverified_claims(token)
            
            # Check token expiration
            if time.time() > claims.get('exp', 0):
                logger.error("Token has expired")
                return False, None
                
            # Check issuer
            expected_issuer = f"https://cognito-idp.{self.region}.amazonaws.com/{self.user_pool_id}"
            if claims.get('iss') != expected_issuer:
                logger.error(f"Invalid issuer: {claims.get('iss')} != {expected_issuer}")
                return False, None
                
            # Check audience (client id)
            audience = claims.get('aud') or claims.get('client_id')
            if audience != self.app_client_id:
                logger.error(f"Invalid audience: {audience} != {self.app_client_id}")
                return False, None
                
            logger.debug(f"Token verified successfully for user: {claims.get('email', 'unknown')}")
            return True, claims
            
        except Exception as e:
            logger.error(f"Token verification error: {str(e)}")
            return False, None
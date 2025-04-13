import { Amplify } from 'aws-amplify';
import {
    fetchAuthSession,
    getCurrentUser,
    signIn as amplifySignIn,
    signOut as amplifySignOut,
    confirmSignUp as amplifyConfirmSignUp,
    resetPassword,
    confirmResetPassword,
    fetchUserAttributes
} from '@aws-amplify/auth';
import { cognitoUserPoolsTokenProvider } from '@aws-amplify/auth/cognito';
import crypto from 'crypto-js';
import { 
    CognitoIdentityProviderClient, 
    SignUpCommand,
    ConfirmSignUpCommand,
    InitiateAuthCommand,
    RespondToAuthChallengeCommand
} from '@aws-sdk/client-cognito-identity-provider';

// Configure Amplify with detailed Cognito configuration
Amplify.configure({
    Auth: {
        Cognito: {
            userPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID,
            userPoolClientId: process.env.REACT_APP_COGNITO_APP_CLIENT_ID,
            userPoolClientSecret: process.env.REACT_APP_COGNITO_CLIENT_SECRET,
            region: process.env.REACT_APP_AWS_REGION
        }
    }
});

// Generate secret hash
const generateSecretHash = (username) => {
    const poolClientId = process.env.REACT_APP_COGNITO_APP_CLIENT_ID;
    const poolClientSecret = process.env.REACT_APP_COGNITO_CLIENT_SECRET;

    if (!poolClientId || !poolClientSecret) {
        throw new Error('Missing Cognito Client ID or Client Secret');
    }

    const message = username + poolClientId;
    const hash = crypto.HmacSHA256(message, poolClientSecret);
    return crypto.enc.Base64.stringify(hash);
};

// AWS SDK Client Configuration
const cognitoClient = new CognitoIdentityProviderClient({ 
    region: process.env.REACT_APP_AWS_REGION 
});

// Custom sign-up method
export const signUp = async ({ username, password, options }) => {
    try {
        console.group('Sign Up Process');
        console.log('Username:', username);
        
        // Generate secret hash
        const secretHash = generateSecretHash(username);

        // Prepare sign-up command
        const signUpCommand = new SignUpCommand({
            ClientId: process.env.REACT_APP_COGNITO_APP_CLIENT_ID,
            Username: username,
            Password: password,
            SecretHash: secretHash,
            UserAttributes: [
                { Name: 'email', Value: username },
                ...(options?.userAttributes 
                    ? Object.entries(options.userAttributes).map(([key, value]) => 
                        ({ Name: key, Value: value })) 
                    : [])
            ]
        });

        // Execute sign-up
        const response = await cognitoClient.send(signUpCommand);
        
        console.log('Sign Up Successful');
        console.groupEnd();
        return response;
    } catch (error) {
        console.error('Sign Up Error Details:', {
            name: error.name,
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        console.groupEnd();
        throw error;
    }
};

// Confirm sign-up method
export const confirmSignUp = async ({ username, confirmationCode }) => {
    try {
        console.group('Confirm Sign Up Process');
        console.log('Username:', username);
        
        // Generate secret hash
        const secretHash = generateSecretHash(username);

        // Prepare confirmation command
        const confirmSignUpCommand = new ConfirmSignUpCommand({
            ClientId: process.env.REACT_APP_COGNITO_APP_CLIENT_ID,
            Username: username,
            ConfirmationCode: confirmationCode,
            SecretHash: secretHash
        });

        // Execute confirmation
        const response = await cognitoClient.send(confirmSignUpCommand);

        console.log('Confirmation Successful');
        console.groupEnd();
        return response;
    } catch (error) {
        console.error('Confirm Sign Up Error Details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        console.groupEnd();
        throw error;
    }
};

// Sign-in method
export const signIn = async ({ username, password, newPassword, requiredAttributes = {} }) => {
    try {
        console.log('Initiating Sign In for:', username);

        // Validate configuration
        const poolClientId = process.env.REACT_APP_COGNITO_APP_CLIENT_ID;
        const poolClientSecret = process.env.REACT_APP_COGNITO_CLIENT_SECRET;
        const userPoolId = process.env.REACT_APP_COGNITO_USER_POOL_ID;

        if (!poolClientId || !poolClientSecret || !userPoolId) {
            throw new Error('Missing Cognito Client Configuration');
        }

        // Generate secret hash
        const secretHash = generateSecretHash(username);
        let response;
        // Attempt sign-in using AWS SDK directly
        try {
            const params = {
                AuthFlow: 'USER_PASSWORD_AUTH',
                ClientId: poolClientId,
                AuthParameters: {
                    USERNAME: username,
                    PASSWORD: password,
                    SECRET_HASH: secretHash
                }
            };

            const command = new InitiateAuthCommand(params);
            response = await cognitoClient.send(command);

            // Store tokens if authentication is successful
            if (response.AuthenticationResult) {
                const { 
                    IdToken, 
                    AccessToken, 
                    RefreshToken 
                } = response.AuthenticationResult;

                localStorage.setItem('idToken', IdToken);
                localStorage.setItem('accessToken', AccessToken);
                localStorage.setItem('refreshToken', RefreshToken);
                localStorage.setItem('username', username);

                return response;
            }

            // Handle potential challenges
            if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
                const error = new Error('New password is required');
                error.name = 'NewPasswordRequiredError';
                
                try {
                    // Extract challenge parameters
                    error.challengeParameters = response.ChallengeParameters || {};
                    
                    error.requiredAttributes = response.ChallengeParameters?.requiredAttributes 
                        ? JSON.parse(response.ChallengeParameters.requiredAttributes)
                        : [];
                } catch (parseError) {
                    console.error('Error parsing challenge parameters:', parseError);
                    error.challengeParameters = {};
                    error.requiredAttributes = [];
                }

                throw error;
            }

        } catch (sdkError) {
            console.error('AWS SDK Authentication Error:', sdkError);
            throw sdkError;
        }

        // If new password is provided for the challenge
        if (newPassword) {
            try {
                const challengeParams = {
                    ChallengeName: 'NEW_PASSWORD_REQUIRED',
                    ClientId: poolClientId,
                    ChallengeResponses: {
                        USERNAME: username,
                        NEW_PASSWORD: newPassword,
                        SECRET_HASH: secretHash,
                        ...Object.fromEntries(
                            Object.entries({
                                email: username,
                                ...requiredAttributes
                            }).map(([key, value]) => [`userAttributes.${key}`, value])
                        )
                    },
                    Session: response.Session
                };

                const challengeCommand = new RespondToAuthChallengeCommand(challengeParams);
                const challengeResponse = await cognitoClient.send(challengeCommand);

                // Store tokens from challenge response
                if (challengeResponse.AuthenticationResult) {
                    const { 
                        IdToken, 
                        AccessToken, 
                        RefreshToken 
                    } = challengeResponse.AuthenticationResult;

                    localStorage.setItem('idToken', IdToken);
                    localStorage.setItem('accessToken', AccessToken);
                    localStorage.setItem('refreshToken', RefreshToken);
                    localStorage.setItem('username', username);

                    return challengeResponse;
                }
            } catch (challengeError) {
                console.error('Challenge Response Error:', challengeError);
                throw challengeError;
            }
        }

        throw new Error('Authentication failed: No authentication result');
    
    } catch (error) {
        console.error('Overall Sign In Error:', {
            name: error.name,
            message: error.message,
            code: error.code || 'N/A'
        });

        throw error;
    }
};

// Current authenticated user method
export const currentAuthenticatedUser = async () => {
    try {
        // First, check localStorage for existing tokens
        const idToken = localStorage.getItem('idToken');
        const accessToken = localStorage.getItem('accessToken');
        const username = localStorage.getItem('username');

        // If tokens exist, return a basic user object
        if (idToken && accessToken && username) {
            return {
                username,
                attributes: { 
                    email: username 
                }
            };
        }

        // Try Amplify's getCurrentUser method
        const user = await getCurrentUser();
        return user;
    } catch (error) {
        console.error('Authentication Check Error:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });

        // Throw a clear, specific error
        throw new Error('No authenticated user');
    }
};

// Sign out method
export const signOut = async () => {
    try {
        // Use Amplify sign out
        await amplifySignOut();

        // Clear localStorage
        localStorage.removeItem('idToken');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('username');

        return true;
    } catch (error) {
        console.error('Sign Out Error:', error);
        throw error;
    }
};

// Other authentication methods
export const forgotPassword = resetPassword;
export const forgotPasswordSubmit = confirmResetPassword;
export { fetchUserAttributes };
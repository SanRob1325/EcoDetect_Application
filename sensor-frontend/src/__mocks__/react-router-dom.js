const React = require('react');

module.exports = {
  BrowserRouter: ({ children }) => <div data-testid="mock-browser-router">{children}</div>,
  Router: ({ children }) => <div data-testid="mock-router">{children}</div>,
  Routes: ({ children }) => <div data-testid="mock-routes">{children}</div>,
  Route: ({ element }) => element,
  Link: ({ children, to, ...props }) => (
    <a href={to} data-testid="mock-link" {...props}>
      {children}
    </a>
  ),
  NavLink: ({ children, to, ...props }) => (
    <a href={to} data-testid="mock-navlink" {...props}>
      {children}
    </a>
  ),
  Navigate: () => null,
  useNavigate: () => jest.fn(),
  useLocation: () => ({
    pathname: '/',
    search: '',
    hash: '',
    state: null,
    key: ''
  }),
  useParams: () => ({}),
  Outlet: () => null,
};
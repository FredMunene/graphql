# Zone01 Profile Page

A GraphQL + JWT authenticated profile page that displays user statistics and interactive SVG charts.

## Features

- **Authentication**: Login with username/email and password using JWT tokens
- **Profile Data**: Displays user information, total XP, projects completed, and success rate
- **Interactive Charts**: 
  - XP over time (line chart with animation)
  - Pass/Fail ratio (pie chart with hover tooltips)
- **Responsive Design**: Works on desktop and mobile devices
- **Security**: JWT stored in sessionStorage with automatic logout on token expiration

## Technology Stack

- Pure HTML, CSS, and JavaScript (no frameworks)
- GraphQL API integration
- SVG-based charts with animations
- JWT authentication
- Responsive CSS Grid layout

## Setup and Deployment

### Local Development

1. Clone or download the project files
2. Open `index.html` in a web browser
3. Use your Zone01 credentials to login

### Static Hosting Deployment

The application is ready for deployment on any static hosting service:

#### GitHub Pages
1. Push files to a GitHub repository
2. Enable GitHub Pages in repository settings
3. Select source branch (main/master)

#### Netlify
1. Drag and drop the project folder to Netlify
2. Or connect your GitHub repository

#### Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project directory
3. Follow the prompts

### CORS Configuration

If you encounter CORS issues when deployed, the GraphQL endpoint should accept requests from your hosting domain. The application is configured to work with the Zone01 API endpoints:

- GraphQL: `https://learn.zone01kisumu.ke/api/graphql-engine/v1/graphql`
- Authentication: `https://learn.zone01kisumu.ke/api/auth/signin`

## File Structure

```
├── index.html          # Main HTML structure
├── styles.css          # CSS styles and animations
├── app.js             # JavaScript application logic
└── README.md          # This file
```

## Usage

1. **Login**: Enter your Zone01 username/email and password
2. **View Profile**: See your user information and statistics
3. **Explore Charts**: Hover over chart elements for detailed information
4. **Logout**: Click the logout button to clear session and return to login

## GraphQL Queries Used

- **User Data**: Fetches basic user information (id, login)
- **Transactions**: Retrieves XP transactions for calculating totals and time series
- **Results**: Gets pass/fail data for success rate calculations

## Security Features

- JWT tokens stored in sessionStorage (cleared on logout)
- Automatic logout on token expiration (401 responses)
- Basic authentication for initial login
- No sensitive data stored in localStorage

## Browser Compatibility

- Modern browsers with ES6+ support
- SVG support required for charts
- Fetch API support required

## Performance

- Minimal dependencies (no external libraries)
- Efficient SVG rendering
- Responsive design with CSS Grid
- Optimized GraphQL queries
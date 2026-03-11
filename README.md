# GameHub - Gaming Platform

A full-stack gaming website where users can create accounts, join different gaming leagues, and form competitive teams.

## Features

- **User Accounts**: Register and login securely
- **Team Creation**: Create and manage gaming teams
- **League Participation**: Join competitive gaming leagues
- **Team Management**: Invite teammates and manage team roster
- **League Standings**: View rankings and participate in tournaments
- **User Dashboard**: Track stats, teams, and league participation
- **Multiple Games**: Support for Valorant, CS:GO, League of Legends, Dota 2, and Fortnite

## Project Structure

```
spe/
├── public/                 # Frontend files
│   ├── index.html         # Home page
│   ├── login.html         # Login/Registration
│   ├── dashboard.html     # User dashboard
│   ├── leagues.html       # Browse leagues
│   ├── teams.html         # Browse teams
│   ├── css/
│   │   └── style.css      # Main stylesheet
│   └── js/
│       ├── auth.js        # Authentication logic
│       ├── dashboard.js   # Dashboard functionality
│       ├── leagues.js     # Leagues functionality
│       └── teams.js       # Teams functionality
├── server.js              # Express backend server
├── package.json           # Dependencies
├── gamehub.db            # SQLite database (created at runtime)
└── README.md             # This file
```

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Setup Steps

1. **Install Dependencies**
```bash
cd c:\Users\GMCH BME\Desktop\spe
npm install
```

2. **Start the Server**
```bash
npm start
```

You should see:
```
╔════════════════════════════════════════╗
║      GameHub Server Running 🎮        ║
║     http://localhost:3000              ║
╚════════════════════════════════════════╝
```

3. **Access the Website**
Open your browser and navigate to: `http://localhost:3000`

## How to Use

### Creating an Account
1. Click "Register" on the homepage
2. Enter username, email, and password
3. Click "Register" to create your account
4. Login with your credentials

### Creating a Team
1. Login to your account
2. Click "Dashboard"
3. Go to "My Teams" section
4. Click "Create Team"
5. Fill in team details (name, game, description)
6. Click "Create Team"

### Joining a League
1. Click "Leagues" from the navigation
2. Browse available leagues or search
3. Click on a league to view details
4. Click "Join League" (requires having a team)

### Joining a Team
1. Click "Teams" from the navigation
2. Browse available teams
3. Click on a team to view member list
4. Click "Join Team"

## Available Games

- Valorant
- CS:GO (Counter-Strike: Global Offensive)
- League of Legends
- Dota 2
- Fortnite

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Leagues
- `GET /api/leagues/all` - Get all leagues
- `GET /api/leagues/:id` - Get league details
- `POST /api/leagues/:id/join` - Join a league
- `GET /api/leagues/user` - Get user's leagues

### Teams
- `GET /api/teams/all` - Get all teams
- `GET /api/teams/:id` - Get team details
- `POST /api/teams/create` - Create new team
- `POST /api/teams/:id/join` - Join a team
- `GET /api/teams/user` - Get user's teams

### Users
- `GET /api/users/stats` - Get user statistics

## Database Schema

### Users Table
- id: Primary key
- username: Unique username
- email: Unique email
- password: Hashed password
- created_at: Account creation timestamp
- updated_at: Last update timestamp

### Teams Table
- id: Primary key
- name: Team name
- description: Team description
- game: Game type
- leader_id: Team leader's user ID
- max_members: Maximum team size (default: 5)
- created_at: Team creation timestamp

### Team Members Table
- team_id: References teams
- user_id: References users
- role: Member role (Leader, Member, etc.)
- joined_at: Join timestamp

### Leagues Table
- id: Primary key
- name: League name
- description: League description
- game: Game type
- prize_pool: Prize amount
- created_at: League creation timestamp

### League Participants Table
- league_id: References leagues
- team_id: References teams
- user_id: References users
- joined_at: Join timestamp

## Features Included

✅ User Registration & Login
✅ Team Creation & Management
✅ League Browse & Join
✅ Team Browse & Join
✅ User Dashboard with Stats
✅ Multiple Games Support
✅ Responsive Design
✅ Search & Filter
✅ JWT Authentication
✅ SQLite Database

## Future Enhancements

- Tournament matching system
- Real-time chat
- Match scheduling
- Performance statistics
- Leaderboards
- Achievements & Badges
- Email notifications
- Social features

## Technical Stack

- **Frontend**: HTML5, CSS3, JavaScript
- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: Bcrypt for password hashing
- **API**: RESTful API

## Notes

- Change `JWT_SECRET` in `server.js` for production
- Database file `gamehub.db` is created automatically
- Sample leagues and teams are created on first run
- Sample user ID is set to 1 for demo purposes

## Troubleshooting

**Port 3000 already in use:**
```bash
# Change the PORT variable in server.js
# Or kill the process using port 3000
```

**Cannot connect to backend:**
- Ensure the server is running on port 3000
- Check browser console for errors (F12)
- Verify CORS is enabled

**Database errors:**
- Delete `gamehub.db` and restart server to reinitialize
- Ensure write permissions in the project directory

## License

This project is open-source and available for educational purposes.

## Support

For issues or feature requests, contact the development team.

---

**Enjoy your gaming platform! 🎮**

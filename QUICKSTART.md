# GameHub Quick Start Guide

## 🚀 Getting Started (5 minutes)

### Step 1: Install Dependencies
Open PowerShell in the project folder and run:
```powershell
npm install
```

### Step 2: Start the Server
```powershell
npm start
```

Wait for the message:
```
╔════════════════════════════════════════╗
║      GameHub Server Running 🎮        ║
║     http://localhost:3000              ║
╚════════════════════════════════════════╝
```

### Step 3: Open the Website
Open your browser and go to: **http://localhost:3000**

---

## 📋 Test Account

You can create a new account or the system comes with sample data.

### Create Test Account:
1. Click "Register"
2. Enter details:
   - Username: `testplayer`
   - Email: `test@example.com`
   - Password: `password123`
3. Click "Register"
4. Login with these credentials

---

## 🎮 First Time Actions

### Try These Features:

1. **Create a Team**
   - Go to Dashboard
   - Click "My Teams" → "Create Team"
   - Fill in team name and select a game

2. **Browse Leagues**
   - Click "Leagues" in navigation
   - View available competitive leagues
   - Click on a league to see details

3. **Browse Teams**
   - Click "Teams" in navigation
   - Search or filter by game
   - Click on a team to view members

4. **Check Your Stats**
   - Go to Dashboard
   - Click "Statistics"
   - View your teams, leagues, and stats

---

## 🛠️ Troubleshooting

### Server won't start?
- Make sure Node.js is installed: `node --version`
- Try deleting node_modules and reinstalling: `npm install`
- Check if port 3000 is free

### Can't see website?
- Check that server is running
- Try: http://localhost:3000 (not https)
- Check browser console (F12) for errors

### Database error?
- Delete `gamehub.db` file
- Restart server

---

## 📁 What's Inside

```
public/          ← All website files (HTML, CSS, JS)
server.js        ← Backend server
package.json     ← Dependencies list
README.md        ← Full documentation
gamehub.db       ← Database (created automatically)
```

---

## 🎯 Key Features Available

✅ Create account & login
✅ Create & manage teams
✅ Browse & join leagues
✅ Browse & join teams
✅ View user dashboard
✅ Search & filter
✅ Multiple game support

---

## 📧 Sample Data

The system comes with:
- 5 Sample Leagues (Valorant, CS:GO, LoL, Dota 2, Fortnite)
- 5 Sample Teams across different games
- Ready for user registration

---

**You're all set! Start exploring GameHub! 🎮**

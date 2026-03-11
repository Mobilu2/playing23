const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-change-this-in-production';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'uploads', 'profiles');
        // Create directory if it doesn't exist
        const fs = require('fs');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// Database setup
const db = new sqlite3.Database(path.join(__dirname, 'gamehub.db'), (err) => {
    if (err) console.error('Database connection error:', err);
    else console.log('Connected to SQLite database');
    
    initializeDatabase();
});

function initializeDatabase() {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            profile_picture TEXT,
            location TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Teams table
    db.run(`
        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            game TEXT NOT NULL,
            leader_id INTEGER,
            max_members INTEGER DEFAULT 5,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (leader_id) REFERENCES users(id)
        )
    `);
    
    // Team Members table
    db.run(`
        CREATE TABLE IF NOT EXISTS team_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER,
            user_id INTEGER,
            role TEXT DEFAULT 'Member',
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (team_id) REFERENCES teams(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(team_id, user_id)
        )
    `);
    
    // Leagues table
    db.run(`
        CREATE TABLE IF NOT EXISTS leagues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            game TEXT NOT NULL,
            prize_pool TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // League Participants table
    db.run(`
        CREATE TABLE IF NOT EXISTS league_participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            league_id INTEGER,
            team_id INTEGER,
            user_id INTEGER,
            status TEXT DEFAULT 'approved',
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (league_id) REFERENCES leagues(id),
            FOREIGN KEY (team_id) REFERENCES teams(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    // ensure status column exists on upgrades (ignore error if already added)
    db.run(`ALTER TABLE league_participants ADD COLUMN status TEXT DEFAULT 'approved'`, err => {
        // SQLite will error if column already exists, which we can safely ignore
    });

    // League Members table (for eFootball individual participants)
    db.run(`
        CREATE TABLE IF NOT EXISTS league_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            league_id INTEGER,
            user_id INTEGER,
            status TEXT DEFAULT 'pending',
            payment_status TEXT DEFAULT 'unpaid',
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (league_id) REFERENCES leagues(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(league_id, user_id)
        )
    `);

    // League Formats table
    db.run(`
        CREATE TABLE IF NOT EXISTS league_formats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            league_id INTEGER,
            format_type TEXT NOT NULL,
            max_participants INTEGER DEFAULT 32,
            stage TEXT,
            description TEXT,
            FOREIGN KEY (league_id) REFERENCES leagues(id)
        )
    `);

    // League Draws table (stores random pairing results and group assignments)
    db.run(`
        CREATE TABLE IF NOT EXISTS league_draws (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            league_id INTEGER,
            draw_number INTEGER,
            participant_1_id INTEGER,
            participant_2_id INTEGER,
            match_order INTEGER,
            group_number INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (league_id) REFERENCES leagues(id)
        )
    `);

    // League Settings table
    // players_per_group: how many participants should be in each group (used for group-stage format)
    db.run(`
        CREATE TABLE IF NOT EXISTS league_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            league_id INTEGER UNIQUE,
            admin_id INTEGER,
            entry_fee DECIMAL(10, 2) DEFAULT 3000,
            currency TEXT DEFAULT 'TSH',
            game TEXT,
            format TEXT,
            max_participants INTEGER DEFAULT 32,
            players_per_group INTEGER DEFAULT 4,
            status TEXT DEFAULT 'open',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (league_id) REFERENCES leagues(id),
            FOREIGN KEY (admin_id) REFERENCES users(id)
        )
    `);
    // migrations: add new columns if they don't exist
    db.run(`ALTER TABLE league_settings ADD COLUMN players_per_group INTEGER DEFAULT 4`, err => {
        // ignore errors (column exists)
    });
    db.run(`ALTER TABLE league_draws ADD COLUMN group_number INTEGER`, err => {
        // ignore errors (column exists or table missing)
    });

    // Matches table
    db.run(`
        CREATE TABLE IF NOT EXISTS matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            league_id INTEGER,
            match_number INTEGER,
            team_1_id INTEGER,
            team_2_id INTEGER,
            user_1_id INTEGER,
            user_2_id INTEGER,
            stage TEXT,
            round TEXT,
            seed_1 INTEGER,
            seed_2 INTEGER,
            scheduled_date DATETIME,
            scheduled_time TEXT,
            venue TEXT,
            status TEXT DEFAULT 'scheduled',
            winner_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (league_id) REFERENCES leagues(id),
            FOREIGN KEY (team_1_id) REFERENCES teams(id),
            FOREIGN KEY (team_2_id) REFERENCES teams(id),
            FOREIGN KEY (user_1_id) REFERENCES users(id),
            FOREIGN KEY (user_2_id) REFERENCES users(id)
        )
    `);

    // Match Results table
    db.run(`
        CREATE TABLE IF NOT EXISTS match_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER UNIQUE,
            user_id INTEGER,
            score_team_1 INTEGER,
            score_team_2 INTEGER,
            result_details TEXT,
            screenshot_url TEXT,
            submitted_by INTEGER,
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'pending',
            approved_by INTEGER,
            approved_at DATETIME,
            FOREIGN KEY (match_id) REFERENCES matches(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (submitted_by) REFERENCES users(id),
            FOREIGN KEY (approved_by) REFERENCES users(id)
        )
    `);

    // Tournament Bracket table
    db.run(`
        CREATE TABLE IF NOT EXISTS tournament_brackets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            league_id INTEGER UNIQUE,
            format TEXT,
            total_participants INTEGER,
            current_round TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (league_id) REFERENCES leagues(id)
        )
    `);

    // Tournament Participants table (for seeding)
    db.run(`
        CREATE TABLE IF NOT EXISTS tournament_participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bracket_id INTEGER,
            user_id INTEGER,
            team_id INTEGER,
            seed INTEGER,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (bracket_id) REFERENCES tournament_brackets(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (team_id) REFERENCES teams(id),
            UNIQUE(bracket_id, user_id, team_id)
        )
    `);

    // Payments table
    db.run(`
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            league_id INTEGER,
            team_id INTEGER,
            amount DECIMAL(10, 2),
            currency TEXT DEFAULT 'TSH',
            payment_method TEXT,
            status TEXT DEFAULT 'pending',
            transaction_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (league_id) REFERENCES leagues(id),
            FOREIGN KEY (team_id) REFERENCES teams(id)
        )
    `);

    // Chat Messages table
    db.run(`
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            league_id INTEGER,
            user_id INTEGER,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (league_id) REFERENCES leagues(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // League Standings table
    db.run(`
        CREATE TABLE IF NOT EXISTS league_standings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            league_id INTEGER,
            user_id INTEGER,
            team_id INTEGER,
            group_number INTEGER,
            played INTEGER DEFAULT 0,
            won INTEGER DEFAULT 0,
            drawn INTEGER DEFAULT 0,
            lost INTEGER DEFAULT 0,
            goals_for INTEGER DEFAULT 0,
            goals_against INTEGER DEFAULT 0,
            goal_difference INTEGER DEFAULT 0,
            points INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (league_id) REFERENCES leagues(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (team_id) REFERENCES teams(id),
            UNIQUE(league_id, user_id)
        )
    `);
    // migration for pre‑existing databases
    db.run(`ALTER TABLE league_standings ADD COLUMN group_number INTEGER`, err => { });

    // Player Statistics table (for eFootball)
    db.run(`
        CREATE TABLE IF NOT EXISTS player_statistics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            league_id INTEGER,
            user_id INTEGER,
            goals INTEGER DEFAULT 0,
            assists INTEGER DEFAULT 0,
            matches_played INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (league_id) REFERENCES leagues(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(league_id, user_id)
        )
    `);

    // Creator Payment Accounts table
    db.run(`
        CREATE TABLE IF NOT EXISTS creator_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            league_id INTEGER UNIQUE,
            creator_id INTEGER,
            account_type TEXT NOT NULL, -- 'mpesa', 'halopesa', 'mix', 'airtel', 'visa_crdb', 'visa_nmb'
            account_number TEXT NOT NULL,
            account_name TEXT NOT NULL,
            bank_name TEXT, -- for visa accounts
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (league_id) REFERENCES leagues(id),
            FOREIGN KEY (creator_id) REFERENCES users(id)
        )
    `);

    // Prize Distribution table
    db.run(`
        CREATE TABLE IF NOT EXISTS prize_distribution (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            league_id INTEGER,
            position INTEGER, -- 1st, 2nd, 3rd, etc.
            percentage DECIMAL(5,2), -- percentage of prize pool
            amount DECIMAL(10,2), -- fixed amount if not percentage
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (league_id) REFERENCES leagues(id),
            UNIQUE(league_id, position)
        )
    `);

    // Prize Payments table
    db.run(`
        CREATE TABLE IF NOT EXISTS prize_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            league_id INTEGER,
            winner_id INTEGER,
            position INTEGER,
            amount DECIMAL(10,2),
            status TEXT DEFAULT 'pending', -- pending, paid, failed
            payment_method TEXT,
            transaction_id TEXT,
            paid_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (league_id) REFERENCES leagues(id),
            FOREIGN KEY (winner_id) REFERENCES users(id)
        )
    `);

    // Initialize sample leagues
    initializeSampleLeagues();
    initializeSampleTeams();
}

function initializeSampleLeagues() {
    db.run(`SELECT COUNT(*) as count FROM leagues`, (err, row) => {
        if (row && row.count === 0) {
            const leagues = [
                { name: 'Valorant Pro League', description: 'Competitive Valorant league', game: 'valorant', prize_pool: '$100,000' },
                { name: 'CS:GO Championship', description: 'Global Counter-Strike competition', game: 'csgo', prize_pool: '$50,000' },
                { name: 'League Masters', description: 'League of Legends competitive league', game: 'lol', prize_pool: '$75,000' },
                { name: 'Dota 2 International', description: 'International Dota 2 tournament', game: 'dota2', prize_pool: '$150,000' },
                { name: 'Fortnite Champions', description: 'Battle royale championship', game: 'fortnite', prize_pool: '$200,000' }
            ];
            
            leagues.forEach(league => {
                db.run(`INSERT INTO leagues (name, description, game, prize_pool) VALUES (?, ?, ?, ?)`,
                    [league.name, league.description, league.game, league.prize_pool]
                );
            });
        }
    });
}

function initializeSampleTeams() {
    db.run(`SELECT COUNT(*) as count FROM teams`, (err, row) => {
        if (row && row.count === 0) {
            const teams = [
                { name: 'Shadow Riders', description: 'Competitive Valorant team', game: 'valorant' },
                { name: 'Cyber Knights', description: 'CS:GO professionals', game: 'csgo' },
                { name: 'Dragon Slayers', description: 'League of Legends squad', game: 'lol' },
                { name: 'Phoenix Rising', description: 'Dota 2 team', game: 'dota2' },
                { name: 'Storm Warriors', description: 'Fortnite champions', game: 'fortnite' }
            ];
            
            teams.forEach(team => {
                db.run(`INSERT INTO teams (name, description, game, leader_id) VALUES (?, ?, ?, 1)`,
                    [team.name, team.description, team.game]
                );
            });
        }
    });
}

// Helper function to get user COUNT
function getTeamMembersCount(teamId, callback) {
    db.get(`SELECT COUNT(*) as count FROM team_members WHERE team_id = ?`, [teamId], (err, row) => {
        callback(err, row ? row.count : 0);
    });
}

// Authentication Routes
app.post('/api/auth/register', (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields required' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    db.run(`INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
        [username, email, hashedPassword],
        function(err) {
            if (err) {
                return res.status(400).json({ message: 'User already exists or error occurred' });
            }
            res.json({ message: 'User registered successfully' });
        }
    );
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password required' });
    }
    
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        
        if (!bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                profile_picture: user.profile_picture,
                location: user.location,
                created_at: user.created_at
            }
        });
    });
});

// Middleware to verify JWT
function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Invalid token' });
        }
        req.userId = decoded.id;
        next();
    });
}

// ========= Draw management helpers =========
// Pair approved eFootball members randomly and save draw results
function performRandomDraw(leagueId, drawNumber, callback) {
    // determine group size from league settings (default 4)
    db.get(`SELECT players_per_group FROM league_settings WHERE league_id = ?`, [leagueId], (err, settings) => {
        const groupSize = settings?.players_per_group || 4;
        db.all(
            `SELECT user_id FROM league_members WHERE league_id = ? AND status = 'approved'`,
            [leagueId],
            (err2, rows) => {
                if (err2) return callback(err2);
                const participants = rows.map(r => r.user_id);
                // shuffle
                for (let i = participants.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [participants[i], participants[j]] = [participants[j], participants[i]];
                }
                let order = 1;
                for (let i = 0; i < participants.length; i += 2) {
                    const p1 = participants[i];
                    const p2 = participants[i + 1] || null;
                    const grp = Math.floor(i / groupSize) + 1;
                    db.run(
                        `INSERT INTO league_draws (league_id, draw_number, participant_1_id, participant_2_id, match_order, group_number)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [leagueId, drawNumber, p1, p2, order++, grp],
                        err3 => {
                            if (err3) console.error('Error inserting draw pair', err3);
                        }
                    );
                    // also update standings group assignment for each participant
                    db.run(`UPDATE league_standings SET group_number = ? WHERE league_id = ? AND user_id = ?`,
                        [grp, leagueId, p1]);
                    if (p2) {
                        db.run(`UPDATE league_standings SET group_number = ? WHERE league_id = ? AND user_id = ?`,
                            [grp, leagueId, p2]);
                    }
                }
                callback(null);
            }
        );
    });
}

// Check if the league meets conditions to trigger draw and perform it
function checkAndPerformDraw(leagueId) {
    db.get(
        `SELECT required_participants, current_participants, draw_triggered
         FROM league_draw_status WHERE league_id = ?`,
        [leagueId],
        (err, status) => {
            if (err) return;
            if (!status) {
                // ensure a draw_status row exists using max_participants default
                db.get(`SELECT max_participants FROM league_settings WHERE league_id = ?`, [leagueId], (err2, row) => {
                    const reqVal = row?.max_participants || 0;
                    db.run(
                        `INSERT OR IGNORE INTO league_draw_status (league_id, required_participants, current_participants, draw_triggered)
                         VALUES (?, ?, 0, 0)`,
                        [leagueId, reqVal], () => {
                            // re-check now that row is created
                            checkAndPerformDraw(leagueId);
                        }
                    );
                });
                return;
            }
            if (status.draw_triggered) return;

            db.get(
                `SELECT COUNT(*) as pending FROM league_members WHERE league_id = ? AND status = 'pending'`,
                [leagueId],
                (err2, row) => {
                    if (err2) return;
                    const pending = row?.pending || 0;
                    const meetsRequired =
                        status.required_participants > 0 &&
                        status.current_participants >= status.required_participants;

                    if (pending === 0 && meetsRequired) {
                        performRandomDraw(leagueId, 1, drawErr => {
                            if (drawErr) {
                                console.error('Error performing draw for league', leagueId, drawErr);
                            }
                            db.run(
                                `UPDATE league_draw_status SET draw_triggered = 1, last_draw_at = CURRENT_TIMESTAMP
                                 WHERE league_id = ?`,
                                [leagueId]
                            );
                        });
                    }
                }
            );
        }
    );
}

// Leagues Routes
app.get('/api/leagues/all', (req, res) => {
    db.all(`
        SELECT l.*, ls.entry_fee, ls.max_participants, ls.players_per_group, ls.status
        FROM leagues l
        LEFT JOIN league_settings ls ON l.id = ls.league_id
        ORDER BY l.created_at DESC
    `, (err, leagues) => {
        if (err) return res.status(500).json({ message: 'Error fetching leagues' });
        // ensure default for any row lacking the column
        leagues = (leagues || []).map(l => ({ ...l, players_per_group: l.players_per_group || 4 }));
        res.json({ leagues });
    });
});

app.get('/api/leagues/:id', (req, res) => {
    const leagueId = req.params.id;

    // fetch admin info and group sizing as well
    db.get(`SELECT l.*, ls.admin_id, ls.players_per_group FROM leagues l
            LEFT JOIN league_settings ls ON l.id = ls.league_id
            WHERE l.id = ?`, [leagueId], (err, league) => {
        if (err || !league) {
            return res.status(404).json({ message: 'League not found' });
        }
        
        // Get participants/standings based on game type
        let query, params;
        if (league.game === 'eFootball') {
            query = `
                SELECT lm.*, u.username as team_name, u.id as leader_id, lm.joined_at
                FROM league_members lm
                LEFT JOIN users u ON lm.user_id = u.id
                WHERE lm.league_id = ?
                ORDER BY lm.joined_at ASC
            `;
            params = [leagueId];
        } else {
            query = `
                SELECT lp.*, t.name as team_name, t.leader_id, u.username as leader_name
                FROM league_participants lp
                LEFT JOIN teams t ON lp.team_id = t.id
                LEFT JOIN users u ON t.leader_id = u.id
                WHERE lp.league_id = ?
            `;
            params = [leagueId];
        }
        
        db.all(query, params, (err, standings) => {
            // count only approved participants for total
            if (standings) {
                league.participants = standings.filter(s => s.status === 'approved').length;
            } else {
                league.participants = 0;
            }
            league.standings = standings || [];
            // if eFootball we also attach members array for convenience
            if (league.game === 'eFootball') {
                league.members = league.standings;
            } else {
                // for team-based leagues expose the list as members as well so front-end can reuse
                league.members = league.standings;
            }
            // ensure a default value exists on the returned object
            if (!league.players_per_group) league.players_per_group = 4;
            res.json({ league });
        });
    });
});

// Request to join a league with a team (non-eFootball). Creates a pending record and records entry fee.
app.post('/api/leagues/:id/join', verifyToken, (req, res) => {
    const leagueId = req.params.id;
    const userId = req.userId;
    
    db.get(`SELECT * FROM teams WHERE leader_id = ?`, [userId], (err, team) => {
        if (!team) {
            return res.status(400).json({ message: 'You must have a team to join a league' });
        }
        
        // insert as pending
        db.run(`INSERT INTO league_participants (league_id, team_id, user_id, status) VALUES (?, ?, ?, 'pending')`,
            [leagueId, team.id, userId],
            function(err) {
                if (err) {
                    return res.status(400).json({ message: 'Already requested to join this league' });
                }

                // create payment record if an entry fee is set
                db.get(`SELECT entry_fee FROM league_settings WHERE league_id = ?`, [leagueId], (err, settings) => {
                    const entry_fee = settings?.entry_fee ?? 0;
                    if (entry_fee > 0) {
                        db.run(`
                            INSERT INTO payments (user_id, team_id, league_id, amount, currency, status)
                            VALUES (?, ?, ?, ?, 'TSH', 'pending')
                        `, [userId, team.id, leagueId, entry_fee], (err) => {
                            // ignore errors
                        });
                    }

                    res.json({ message: 'Join request submitted; pending approval', entry_fee });
                });
            }
        );
    });
});

app.get('/api/leagues/user', verifyToken, (req, res) => {
    db.all(`
        SELECT DISTINCT l.* FROM leagues l
        LEFT JOIN league_participants lp ON l.id = lp.league_id AND lp.user_id = ?
        LEFT JOIN league_members lm ON l.id = lm.league_id AND lm.user_id = ?
        WHERE lp.user_id IS NOT NULL OR lm.user_id IS NOT NULL
    `, [req.userId, req.userId], (err, leagues) => {
        if (err) return res.status(500).json({ message: 'Error fetching leagues' });
        res.json({ leagues });
    });
});

// Teams Routes
app.get('/api/teams/all', (req, res) => {
    db.all(`
        SELECT t.*, u.username as leader_name,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as members_count
        FROM teams t
        LEFT JOIN users u ON t.leader_id = u.id
    `, (err, teams) => {
        if (err) return res.status(500).json({ message: 'Error fetching teams' });
        res.json({ teams });
    });
});

app.get('/api/teams/:id', (req, res) => {
    const teamId = req.params.id;
    
    db.get(`
        SELECT t.*, u.username as leader_name,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as members_count
        FROM teams t
        LEFT JOIN users u ON t.leader_id = u.id
        WHERE t.id = ?
    `, [teamId], (err, team) => {
        if (err || !team) {
            return res.status(404).json({ message: 'Team not found' });
        }
        
        db.all(`
            SELECT u.*, tm.role FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = ?
        `, [teamId], (err, members) => {
            team.members = members || [];
            res.json({ team });
        });
    });
});

app.post('/api/teams/create', verifyToken, (req, res) => {
    const { name, game, description } = req.body;
    
    if (!name || !game) {
        return res.status(400).json({ message: 'Name and game required' });
    }
    
    db.run(`INSERT INTO teams (name, game, description, leader_id) VALUES (?, ?, ?, ?)`,
        [name, game, description, req.userId],
        function(err) {
            if (err) {
                return res.status(500).json({ message: 'Error creating team' });
            }
            
            // Add creator as team leader
            db.run(`INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)`,
                [this.lastID, req.userId, 'Leader'],
                (err) => {
                    if (err) {
                        return res.status(500).json({ message: 'Error adding team leader' });
                    }
                    res.json({ message: 'Team created successfully', teamId: this.lastID });
                }
            );
        }
    );
});

app.post('/api/teams/:id/join', verifyToken, (req, res) => {
    const teamId = req.params.id;
    const userId = req.userId;
    
    db.run(`INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)`,
        [teamId, userId, 'Member'],
        function(err) {
            if (err) {
                return res.status(400).json({ message: 'Already a member or error occurred' });
            }
            res.json({ message: 'Successfully joined team' });
        }
    );
});

app.get('/api/teams/user', verifyToken, (req, res) => {
    db.all(`
        SELECT t.*, u.username as leader_name,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as members_count
        FROM teams t
        LEFT JOIN users u ON t.leader_id = u.id
        JOIN team_members tm ON t.id = tm.team_id
        WHERE tm.user_id = ?
    `, [req.userId], (err, teams) => {
        if (err) return res.status(500).json({ message: 'Error fetching teams' });
        res.json({ teams });
    });
});

// Team Management - Get team members
app.get('/api/teams/:id/manage', verifyToken, (req, res) => {
    const teamId = req.params.id;
    const userId = req.userId;
    
    // Verify user is team leader
    db.get(`SELECT * FROM teams WHERE id = ? AND leader_id = ?`, [teamId, userId], (err, team) => {
        if (err || !team) {
            return res.status(403).json({ message: 'You are not authorized to manage this team' });
        }
        
        // Get team members
        db.all(`
            SELECT tm.id, tm.user_id, u.username, tm.role, tm.joined_at
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = ?
            ORDER BY tm.role DESC, u.username ASC
        `, [teamId], (err, members) => {
            if (err) return res.status(500).json({ message: 'Error fetching members' });
            res.json({ team, members });
        });
    });
});

// Team Management - Update team info
app.put('/api/teams/:id/update', verifyToken, (req, res) => {
    const teamId = req.params.id;
    const userId = req.userId;
    const { name, description, max_members } = req.body;
    
    // Verify user is team leader
    db.get(`SELECT * FROM teams WHERE id = ? AND leader_id = ?`, [teamId, userId], (err, team) => {
        if (err || !team) {
            return res.status(403).json({ message: 'You are not authorized to manage this team' });
        }
        
        const updateName = name || team.name;
        const updateDesc = description !== undefined ? description : team.description;
        const updateMaxMembers = max_members || team.max_members;
        
        db.run(`
            UPDATE teams SET name = ?, description = ?, max_members = ? WHERE id = ?
        `, [updateName, updateDesc, updateMaxMembers, teamId], function(err) {
            if (err) return res.status(500).json({ message: 'Error updating team' });
            res.json({ message: 'Team updated successfully', team: { id: teamId, name: updateName, description: updateDesc, max_members: updateMaxMembers } });
        });
    });
});

// Team Management - Remove member
app.delete('/api/teams/:id/members/:memberId', verifyToken, (req, res) => {
    const teamId = req.params.id;
    const memberId = req.params.memberId;
    const userId = req.userId;
    
    // Verify user is team leader
    db.get(`SELECT * FROM teams WHERE id = ? AND leader_id = ?`, [teamId, userId], (err, team) => {
        if (err || !team) {
            return res.status(403).json({ message: 'You are not authorized to manage this team' });
        }
        
        // Prevent removing the leader
        db.get(`SELECT user_id FROM team_members WHERE id = ? AND team_id = ?`, [memberId, teamId], (err, member) => {
            if (err || !member) {
                return res.status(404).json({ message: 'Member not found' });
            }
            
            if (member.user_id === userId) {
                return res.status(400).json({ message: 'You cannot remove yourself. Disband the team instead.' });
            }
            
            db.run(`DELETE FROM team_members WHERE id = ? AND team_id = ?`, [memberId, teamId], function(err) {
                if (err) return res.status(500).json({ message: 'Error removing member' });
                res.json({ message: 'Member removed successfully' });
            });
        });
    });
});

// Team Management - Promote member
app.put('/api/teams/:id/members/:memberId/promote', verifyToken, (req, res) => {
    const teamId = req.params.id;
    const memberId = req.params.memberId;
    const userId = req.userId;
    const { role } = req.body;
    
    // Verify user is team leader
    db.get(`SELECT * FROM teams WHERE id = ? AND leader_id = ?`, [teamId, userId], (err, team) => {
        if (err || !team) {
            return res.status(403).json({ message: 'You are not authorized to manage this team' });
        }
        
        // Verify member exists and is not the leader
        db.get(`SELECT user_id FROM team_members WHERE id = ? AND team_id = ?`, [memberId, teamId], (err, member) => {
            if (err || !member) {
                return res.status(404).json({ message: 'Member not found' });
            }
            
            const newRole = role || 'Co-Leader';
            db.run(`UPDATE team_members SET role = ? WHERE id = ? AND team_id = ?`, [newRole, memberId, teamId], function(err) {
                if (err) return res.status(500).json({ message: 'Error promoting member' });
                res.json({ message: `Member promoted to ${newRole}` });
            });
        });
    });
});

// Team Management - Get team matches
app.get('/api/teams/:id/matches', verifyToken, (req, res) => {
    const teamId = req.params.id;
    
    db.all(`
        SELECT m.*, t1.name as team_1_name, t2.name as team_2_name
        FROM matches m
        LEFT JOIN teams t1 ON m.team_1_id = t1.id
        LEFT JOIN teams t2 ON m.team_2_id = t2.id
        WHERE m.team_1_id = ? OR m.team_2_id = ?
        ORDER BY m.scheduled_date DESC
        LIMIT 50
    `, [teamId, teamId], (err, matches) => {
        if (err) return res.status(500).json({ message: 'Error fetching matches' });
        res.json({ matches: matches || [] });
    });
});

// Team Management - Delete team
app.delete('/api/teams/:id', verifyToken, (req, res) => {
    const teamId = req.params.id;
    const userId = req.userId;
    
    // Verify user is team leader
    db.get(`SELECT * FROM teams WHERE id = ? AND leader_id = ?`, [teamId, userId], (err, team) => {
        if (err || !team) {
            return res.status(403).json({ message: 'You are not authorized to delete this team' });
        }
        
        // Delete team members first
        db.run(`DELETE FROM team_members WHERE team_id = ?`, [teamId], (err) => {
            if (err) return res.status(500).json({ message: 'Error deleting team' });
            
            // Delete the team
            db.run(`DELETE FROM teams WHERE id = ?`, [teamId], function(err) {
                if (err) return res.status(500).json({ message: 'Error deleting team' });
                res.json({ message: 'Team deleted successfully' });
            });
        });
    });
});

// User Routes
app.get('/api/users/stats', verifyToken, (req, res) => {
    const userId = req.userId;
    
    db.get(`
        SELECT 
            (SELECT COUNT(*) FROM teams WHERE leader_id = ?) as teams_count,
            (SELECT COUNT(DISTINCT league_id) FROM league_participants WHERE user_id = ?) as leagues_count,
            0 as wins,
            'Unranked' as rank
    `, [userId, userId], (err, stats) => {
        if (err) return res.status(500).json({ message: 'Error fetching stats' });
        res.json(stats || { teams_count: 0, leagues_count: 0, wins: 0, rank: 'Unranked' });
    });
});

// Profile Picture Upload
app.post('/api/users/profile-picture', verifyToken, upload.single('profilePicture'), (req, res) => {
    const userId = req.userId;
    
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Save the file path to database
    const filePath = '/uploads/profiles/' + req.file.filename;
    
    db.run(`UPDATE users SET profile_picture = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [filePath, userId],
        function(err) {
            if (err) {
                return res.status(500).json({ message: 'Error updating profile picture' });
            }
            
            res.json({
                message: 'Profile picture updated successfully',
                profilePicture: filePath
            });
        }
    );
});

// Get User Profile
app.get('/api/users/profile', verifyToken, (req, res) => {
    const userId = req.userId;
    
    db.get(`SELECT id, username, email, profile_picture, location, created_at FROM users WHERE id = ?`,
        [userId],
        (err, user) => {
            if (err || !user) {
                return res.status(404).json({ message: 'User not found' });
            }
            
            res.json({ user });
        }
    );
});

// Update User Profile
app.put('/api/users/profile', verifyToken, (req, res) => {
    const userId = req.userId;
    const { username, location } = req.body;
    
    if (!username) {
        return res.status(400).json({ message: 'Username is required' });
    }
    
    db.get(`SELECT id FROM users WHERE username = ? AND id != ?`, [username, userId], (err, existing) => {
        if (existing) {
            return res.status(400).json({ message: 'Username already taken' });
        }
        
        db.run(`
            UPDATE users SET username = ?, location = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [username, location || null, userId], function(err) {
            if (err) {
                return res.status(500).json({ message: 'Error updating profile' });
            }
            
            res.json({
                message: 'Profile updated successfully',
                user: {
                    id: userId,
                    username,
                    location
                }
            });
        });
    });
});

// ============= ADVANCED LEAGUE & MATCH MANAGEMENT ENDPOINTS =============

// Create eFootball/Call of Duty League
app.post('/api/leagues/create', verifyToken, (req, res) => {
    const { name, description, game, format, max_participants, entry_fee, prize_distribution, creator_account } = req.body;
    const adminId = req.userId;

    if (!name || !game || !format) {
        return res.status(400).json({ message: 'Name, game, and format required' });
    }

    db.run(`
        INSERT INTO leagues (name, description, game, prize_pool)
        VALUES (?, ?, ?, ?)
    `, [name, description, game, entry_fee], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Error creating league' });
        }

        const leagueId = this.lastID;

        // Create league settings
// determine players per group; default to 4 when using a group-stage format
    let playersPerGroup = req.body.players_per_group ? parseInt(req.body.players_per_group) : 4;
    if (!playersPerGroup || playersPerGroup < 1) {
        playersPerGroup = 4;
    }

    db.run(`
        INSERT INTO league_settings (league_id, admin_id, entry_fee, game, format, max_participants, players_per_group)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [leagueId, adminId, entry_fee, game, format, max_participants || 32, playersPerGroup], (err) => {
            if (err) {
                return res.status(500).json({ message: 'Error creating league settings' });
            }

            // initialize draw status row using provided required_participants or max_participants
            const required = req.body.required_participants || max_participants || 0;
            db.run(
                `INSERT INTO league_draw_status (league_id, required_participants, current_participants, draw_triggered)
                 VALUES (?, ?, 0, 0)`,
                [leagueId, required],
                drawErr => {
                    if (drawErr) {
                        console.error('Error initializing draw status:', drawErr);
                    }
                }
            );

            // Create creator account if provided
            if (creator_account && entry_fee > 0) {
                db.run(`
                    INSERT INTO creator_accounts (league_id, creator_id, account_type, account_number, account_name, bank_name)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [leagueId, adminId, creator_account.account_type, creator_account.account_number,
                     creator_account.account_name, creator_account.bank_name], (err) => {
                    if (err) {
                        console.error('Error creating creator account:', err);
                        // Don't fail the whole creation for this
                    }
                });
            }

            // Parse and create prize distribution
            if (prize_distribution) {
                parseAndCreatePrizeDistribution(leagueId, prize_distribution);
            }

            res.json({
                message: 'League created successfully',
                leagueId: leagueId,
                admin_id: adminId
            });
        });
    });
});

// Parse prize distribution string and create database entries
function parseAndCreatePrizeDistribution(leagueId, distributionString) {
    // Parse strings like "1st: 50%, 2nd: 30%, 3rd: 20%" or "1st: 50000, 2nd: 30000, 3rd: 20000"
    const parts = distributionString.split(',').map(part => part.trim());

    parts.forEach((part, index) => {
        const match = part.match(/(\d+)(?:st|nd|rd|th):\s*(\d+)(%?)/i);
        if (match) {
            const position = parseInt(match[1]);
            const value = parseInt(match[2]);
            const isPercentage = match[3] === '%';

            db.run(`
                INSERT INTO prize_distribution (league_id, position, percentage, amount, description)
                VALUES (?, ?, ?, ?, ?)
            `, [
                leagueId,
                position,
                isPercentage ? value : null,
                isPercentage ? null : value,
                `${position}${getOrdinalSuffix(position)} Place`
            ], (err) => {
                if (err) {
                    console.error('Error creating prize distribution:', err);
                }
            });
        }
    });
}

function getOrdinalSuffix(num) {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
}

// ============= LEAGUE STANDINGS & STATISTICS ENDPOINTS =============

// Get league standings
app.get('/api/leagues/:id/standings', (req, res) => {
    const leagueId = req.params.id;

    // First get league info
    db.get(`
        SELECT l.*, ls.max_participants, ls.status
        FROM leagues l
        LEFT JOIN league_settings ls ON l.id = ls.league_id
        WHERE l.id = ?
    `, [leagueId], (err, league) => {
        if (err || !league) {
            return res.status(404).json({ message: 'League not found' });
        }

        // Then get standings
        db.all(`
            SELECT ls.*, ls.group_number, u.username, u.profile_picture,
                   (ls.goals_for - ls.goals_against) as goal_difference
            FROM league_standings ls
            JOIN users u ON ls.user_id = u.id
            WHERE ls.league_id = ?
            ORDER BY ls.group_number ASC, ls.points DESC, ls.goal_difference DESC, ls.goals_for DESC
        `, [leagueId], (err, standings) => {
            if (err) {
                return res.status(500).json({ message: 'Error fetching standings' });
            }

            res.json({ league, standings: standings || [] });
        });
    });
});

// Update league standings after match result
app.post('/api/leagues/:id/update-standings', verifyToken, (req, res) => {
    const leagueId = req.params.id;
    const { user1_id, user2_id, goals1, goals2 } = req.body;
    const adminId = req.userId;

    // Verify admin
    db.get(`SELECT * FROM league_settings WHERE league_id = ? AND admin_id = ?`,
        [leagueId, adminId], (err, admin) => {
        if (!admin) {
            return res.status(403).json({ message: 'Only league admin can update standings' });
        }

        // Update standings for both players
        updatePlayerStandings(leagueId, user1_id, goals1, goals2);
        updatePlayerStandings(leagueId, user2_id, goals2, goals1);

        res.json({ message: 'Standings updated successfully' });
    });
});

function updatePlayerStandings(leagueId, userId, goalsFor, goalsAgainst) {
    // Check if player exists in standings
    db.get(`SELECT * FROM league_standings WHERE league_id = ? AND user_id = ?`,
        [leagueId, userId], (err, standing) => {
        if (!standing) {
            // Create new standing entry
            db.run(`
                INSERT INTO league_standings (league_id, user_id, played, goals_for, goals_against)
                VALUES (?, ?, 1, ?, ?)
            `, [leagueId, userId, goalsFor, goalsAgainst]);
        } else {
            // Update existing standing
            const played = standing.played + 1;
            const goals_for = standing.goals_for + goalsFor;
            const goals_against = standing.goals_against + goalsAgainst;
            const goal_difference = goals_for - goals_against;

            let won = standing.won;
            let drawn = standing.drawn;
            let lost = standing.lost;
            let points = standing.points;

            if (goalsFor > goalsAgainst) {
                won += 1;
                points += 3;
            } else if (goalsFor === goalsAgainst) {
                drawn += 1;
                points += 1;
            } else {
                lost += 1;
            }

            db.run(`
                UPDATE league_standings
                SET played = ?, won = ?, drawn = ?, lost = ?, goals_for = ?,
                    goals_against = ?, goal_difference = ?, points = ?, updated_at = CURRENT_TIMESTAMP
                WHERE league_id = ? AND user_id = ?
            `, [played, won, drawn, lost, goals_for, goals_against, goal_difference, points, leagueId, userId]);
        }
    });
}

// Get player statistics (for all leagues)
app.get('/api/leagues/:id/player-stats', (req, res) => {
    const leagueId = req.params.id;

    // Get top scorers
    db.all(`
        SELECT ps.*, u.username, u.profile_picture,
               ROUND(CAST(ps.goals AS FLOAT) / NULLIF(ps.matches_played, 0), 2) as goals_per_match
        FROM player_statistics ps
        JOIN users u ON ps.user_id = u.id
        WHERE ps.league_id = ?
        ORDER BY ps.goals DESC, ps.assists DESC
        LIMIT 10
    `, [leagueId], (err, topScorers) => {
        if (err) return res.status(500).json({ message: 'Error fetching top scorers' });

        // Get top assist providers
        db.all(`
            SELECT ps.*, u.username, u.profile_picture
            FROM player_statistics ps
            JOIN users u ON ps.user_id = u.id
            WHERE ps.league_id = ?
            ORDER BY ps.assists DESC, ps.goals DESC
            LIMIT 10
        `, [leagueId], (err, topAssists) => {
            if (err) return res.status(500).json({ message: 'Error fetching top assists' });

            res.json({
                topScorers: topScorers || [],
                topAssists: topAssists || []
            });
        });
    });
});

// Update player statistics
app.post('/api/leagues/:id/update-player-stats', verifyToken, (req, res) => {
    const leagueId = req.params.id;
    const { user_id, goals, assists } = req.body;
    const adminId = req.userId;

    // Verify admin
    db.get(`SELECT * FROM league_settings WHERE league_id = ? AND admin_id = ?`,
        [leagueId, adminId], (err, admin) => {
        if (!admin) {
            return res.status(403).json({ message: 'Only league admin can update player stats' });
        }

        // Update or insert player statistics
        db.run(`
            INSERT INTO player_statistics (league_id, user_id, goals, assists, matches_played)
            VALUES (?, ?, ?, ?, 1)
            ON CONFLICT(league_id, user_id) DO UPDATE SET
                goals = goals + excluded.goals,
                assists = assists + excluded.assists,
                matches_played = matches_played + 1,
                updated_at = CURRENT_TIMESTAMP
        `, [leagueId, user_id, goals || 0, assists || 0], function(err) {
            if (err) {
                return res.status(500).json({ message: 'Error updating player statistics' });
            }

            res.json({ message: 'Player statistics updated successfully' });
        });
    });
});

// Get prize distribution for league
app.get('/api/leagues/:id/prize-distribution', (req, res) => {
    const leagueId = req.params.id;

    db.all(`
        SELECT * FROM prize_distribution
        WHERE league_id = ?
        ORDER BY position
    `, [leagueId], (err, distribution) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching prize distribution' });
        }

        res.json({ distribution: distribution || [] });
    });
});

// Award prizes to winners
app.post('/api/leagues/:id/award-prizes', verifyToken, (req, res) => {
    const leagueId = req.params.id;
    const { winners } = req.body; // Array of {user_id, position}
    const adminId = req.userId;

    // Verify admin
    db.get(`SELECT * FROM league_settings WHERE league_id = ? AND admin_id = ?`,
        [leagueId, adminId], (err, admin) => {
        if (!admin) {
            return res.status(403).json({ message: 'Only league admin can award prizes' });
        }

        // Get total prize pool (entry fees collected)
        db.get(`
            SELECT COUNT(*) as total_entries, ls.entry_fee
            FROM league_members lm
            JOIN league_settings ls ON lm.league_id = ls.league_id
            WHERE lm.league_id = ? AND lm.payment_status = 'paid'
        `, [leagueId], (err, result) => {
            if (err) return res.status(500).json({ message: 'Error calculating prize pool' });

            const totalPrizePool = (result?.total_entries || 0) * (result?.entry_fee || 0);

            // Get prize distribution
            db.all(`SELECT * FROM prize_distribution WHERE league_id = ? ORDER BY position`,
                [leagueId], (err, distribution) => {
                if (err) return res.status(500).json({ message: 'Error fetching prize distribution' });

                // Award prizes to winners
                winners.forEach(winner => {
                    const prizeRule = distribution.find(d => d.position === winner.position);
                    if (prizeRule) {
                        const amount = prizeRule.percentage ?
                            (totalPrizePool * prizeRule.percentage / 100) : prizeRule.amount;

                        db.run(`
                            INSERT INTO prize_payments (league_id, winner_id, position, amount, status)
                            VALUES (?, ?, ?, ?, 'pending')
                        `, [leagueId, winner.user_id, winner.position, amount]);
                    }
                });

                res.json({ message: 'Prizes awarded successfully' });
            });
        });
    });
});

// Get creator account details
app.get('/api/leagues/:id/creator-account', verifyToken, (req, res) => {
    const leagueId = req.params.id;
    const userId = req.userId;

    // Only league admin can view account details
    db.get(`SELECT * FROM league_settings WHERE league_id = ? AND admin_id = ?`,
        [leagueId, userId], (err, admin) => {
        if (!admin) {
            return res.status(403).json({ message: 'Only league admin can view account details' });
        }

        db.get(`SELECT * FROM creator_accounts WHERE league_id = ?`, [leagueId], (err, account) => {
            if (err) {
                return res.status(500).json({ message: 'Error fetching account details' });
            }

            res.json({ account });
        });
    });
});

// Get League Details with format and settings
app.get('/api/leagues/details/:id', (req, res) => {
    const leagueId = req.params.id;
    
    db.get(`
        SELECT l.*, ls.entry_fee, ls.admin_id, ls.format, ls.max_participants, ls.players_per_group, ls.status
        FROM leagues l
        LEFT JOIN league_settings ls ON l.id = ls.league_id
        WHERE l.id = ?
    `, [leagueId], (err, league) => {
        if (err || !league) {
            return res.status(404).json({ message: 'League not found' });
        }
        
        // Get participants count
        db.all(`
            SELECT COUNT(*) as count FROM league_members WHERE league_id = ?
        `, [leagueId], (err, result) => {
            league.participants_count = result[0]?.count || 0;
            
            // Get league members
            db.all(`
                SELECT lm.*, u.username, u.email, p.payment_status
                FROM league_members lm
                LEFT JOIN users u ON lm.user_id = u.id
                LEFT JOIN payments p ON (p.league_id = ? AND p.user_id = u.id)
                WHERE lm.league_id = ?
            `, [leagueId, leagueId], (err, members) => {
                league.members = members || [];
                // fetch draw status if present
                db.get(`SELECT * FROM league_draw_status WHERE league_id = ?`, [leagueId], (err3, draw) => {
                    league.draw_status = draw || {};
                    res.json({ league });
                });
            });
        });
    });
});

// Join eFootball League
app.post('/api/leagues/:id/join-efootball', verifyToken, (req, res) => {
    const leagueId = req.params.id;
    const userId = req.userId;
    
    // Check if user already joined
    db.get(`
        SELECT * FROM league_members WHERE league_id = ? AND user_id = ?
    `, [leagueId, userId], (err, existing) => {
        if (existing) {
            return res.status(400).json({ message: 'Already joined this league' });
        }
        
        // Add member to league
        db.run(`
            INSERT INTO league_members (league_id, user_id, status, payment_status)
            VALUES (?, ?, 'pending', 'unpaid')
        `, [leagueId, userId], function(err) {
            if (err) {
                return res.status(500).json({ message: 'Error joining league' });
            }
            
            // Create payment record
            db.run(`
                SELECT entry_fee FROM league_settings WHERE league_id = ?
            `, [leagueId], (err, settings) => {
                const entry_fee = settings?.entry_fee ?? 0;
                
                db.run(`
                    INSERT INTO payments (user_id, league_id, amount, currency, status)
                    VALUES (?, ?, ?, 'TSH', 'pending')
                `, [userId, leagueId, entry_fee], (err) => {
                    res.json({
                        message: 'Joined league pending approval from admin',
                        entry_fee: entry_fee,
                        payment_status: 'pending'
                    });
                });
            });
        });
    });
});

// Join Call of Duty Team
app.post('/api/teams/:id/join-cod', verifyToken, (req, res) => {
    const teamId = req.params.id;
    const userId = req.userId;
    
    db.run(`
        INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'Member')
    `, [teamId, userId], function(err) {
        if (err) {
            return res.status(400).json({ message: 'Already a member of this team' });
        }
        
        // Check if team is in a league and charge entry fee
        db.get(`
            SELECT DISTINCT league_id FROM league_participants WHERE team_id = ?
        `, [teamId], (err, result) => {
            if (result) {
                db.run(`
                    SELECT entry_fee FROM league_settings WHERE league_id = ?
                `, [result.league_id], (err, settings) => {
                    const entry_fee = settings?.entry_fee ?? 0;
                    
                    db.run(`
                        INSERT INTO payments (user_id, team_id, league_id, amount, currency, status)
                        VALUES (?, ?, ?, ?, 'TSH', 'pending')
                    `, [userId, teamId, result.league_id, entry_fee], (err) => {
                        res.json({
                            message: 'Successfully joined team. Entry fee: ' + entry_fee + ' TSH',
                            entry_fee: entry_fee
                        });
                    });
                });
            } else {
                res.json({ message: 'Successfully joined team' });
            }
        });
    });
});

// Create Match (Admin only)
app.post('/api/matches/create', verifyToken, (req, res) => {
    const { league_id, match_number, team_1_id, team_2_id, scheduled_date, scheduled_time, venue, stage } = req.body;
    const adminId = req.userId;
    
    // Verify admin
    db.get(`
        SELECT * FROM league_settings WHERE league_id = ? AND admin_id = ?
    `, [league_id, adminId], (err, admin) => {
        if (!admin) {
            return res.status(403).json({ message: 'Only league admin can create matches' });
        }
        
        db.run(`
            INSERT INTO matches (league_id, match_number, team_1_id, team_2_id, scheduled_date, scheduled_time, venue, stage, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
        `, [league_id, match_number, team_1_id, team_2_id, scheduled_date, scheduled_time, venue, stage], function(err) {
            if (err) {
                return res.status(500).json({ message: 'Error creating match' });
            }
            
            res.json({
                message: 'Match created successfully',
                matchId: this.lastID
            });
        });
    });
});

// Get League Matches
app.get('/api/leagues/:id/matches', (req, res) => {
    const leagueId = req.params.id;
    
    db.all(`
        SELECT m.*, 
               u1.username as team_1_name, 
               u2.username as team_2_name,
               mr.score_team_1, mr.score_team_2, mr.status as result_status
        FROM matches m
        LEFT JOIN users u1 ON m.team_1_id = u1.id
        LEFT JOIN users u2 ON m.team_2_id = u2.id
        LEFT JOIN match_results mr ON m.id = mr.match_id
        WHERE m.league_id = ?
        ORDER BY m.stage, m.match_number
    `, [leagueId], (err, matches) => {
        if (err) return res.status(500).json({ message: 'Error fetching matches' });
        res.json({ matches: matches || [] });
    });
});

// Upload Match Result
app.post('/api/matches/:id/result', verifyToken, (req, res) => {
    const matchId = req.params.id;
    const userId = req.userId;
    const { score_team_1, score_team_2, result_details, screenshot_url } = req.body;
    
    // Check if match exists
    db.get(`SELECT * FROM matches WHERE id = ?`, [matchId], (err, match) => {
        if (!match) {
            return res.status(404).json({ message: 'Match not found' });
        }
        
        // User must be a participant
        if (match.team_1_id !== userId && match.team_2_id !== userId && match.user_1_id !== userId && match.user_2_id !== userId) {
            return res.status(403).json({ message: 'You are not a participant in this match' });
        }
        
        db.run(`
            INSERT INTO match_results (match_id, user_id, score_team_1, score_team_2, result_details, screenshot_url, submitted_by, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
        `, [matchId, userId, score_team_1, score_team_2, result_details, screenshot_url, userId], function(err) {
            if (err) {
                return res.status(500).json({ message: 'Error submitting result' });
            }
            
            res.json({
                message: 'Result submitted for admin approval',
                resultId: this.lastID
            });
        });
    });
});

// Approve Match Result (Admin only)
app.put('/api/matches/:id/approve-result', verifyToken, (req, res) => {
    const matchId = req.params.id;
    const adminId = req.userId;
    
    // Get match and verify admin
    db.get(`
        SELECT m.* FROM matches m
        JOIN league_settings ls ON m.league_id = ls.league_id
        WHERE m.id = ? AND ls.admin_id = ?
    `, [matchId, adminId], (err, match) => {
        if (!match) {
            return res.status(403).json({ message: 'Only league admin can approve results' });
        }
        
        // Update result status
        db.run(`
            UPDATE match_results SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP
            WHERE match_id = ?
        `, [adminId, matchId], function(err) {
            if (err) {
                return res.status(500).json({ message: 'Error approving result' });
            }
            
            // Update match status
            db.run(`
                UPDATE matches SET status = 'completed' WHERE id = ?
            `, [matchId], (err) => {
                res.json({ message: 'Result approved successfully' });
            });
        });
    });
});

// Admin Approve League Member or Team Participant
app.put('/api/leagues/:id/approve-member', verifyToken, (req, res) => {
    const leagueId = req.params.id;
    const { user_id, team_id } = req.body;
    const adminId = req.userId;
    
    // Verify admin
    db.get(`
        SELECT * FROM league_settings WHERE league_id = ? AND admin_id = ?
    `, [leagueId, adminId], (err, admin) => {
        if (!admin) {
            return res.status(403).json({ message: 'Only league admin can approve members' });
        }
        
        if (user_id) {
            // check current status to avoid double counting
            db.get(`SELECT status FROM league_members WHERE league_id = ? AND user_id = ?`, [leagueId, user_id], (errCheck, row) => {
                if (errCheck) return res.status(500).json({ message: 'Error checking member status' });
                const alreadyApproved = row && row.status === 'approved';

                db.run(`
                    UPDATE league_members SET status = 'approved' WHERE league_id = ? AND user_id = ?
                `, [leagueId, user_id], function(err) {
                    if (err) {
                        return res.status(500).json({ message: 'Error approving member' });
                    }
                    // Also approve payment if exists
                    db.run(`
                        UPDATE payments SET status = 'confirmed' WHERE league_id = ? AND user_id = ?
                    `, [leagueId, user_id], (err) => {
                        res.json({ message: 'Member approved successfully' });
                    });

                    // update draw status if it's an eFootball league and we just moved from pending to approved
                    if (!alreadyApproved) {
                        db.get(`SELECT game FROM leagues WHERE id = ?`, [leagueId], (err2, league) => {
                            if (league && league.game && league.game.toLowerCase() === 'efootball') {
                                db.run(
                                    `UPDATE league_draw_status SET current_participants = current_participants + 1 WHERE league_id = ?`,
                                    [leagueId],
                                    () => {
                                        // after incrementing, check if we should perform the draw
                                        checkAndPerformDraw(leagueId);
                                    }
                                );
                            }
                        });
                    }
                });
            });
        } else if (team_id) {
            db.run(`
                UPDATE league_participants SET status = 'approved' WHERE league_id = ? AND team_id = ?
            `, [leagueId, team_id], function(err) {
                if (err) {
                    return res.status(500).json({ message: 'Error approving participant' });
                }
                // also update payment record if exists
                db.run(`
                    UPDATE payments SET status = 'confirmed' WHERE league_id = ? AND team_id = ?
                `, [leagueId, team_id], (err) => {
                    res.json({ message: 'Participant approved successfully' });
                });
            });
        } else {
            res.status(400).json({ message: 'No user_id or team_id provided' });
        }
    });
});

// Get Pending Approvals (Admin view)
app.get('/api/leagues/:id/pending-approvals', verifyToken, (req, res) => {
    const leagueId = req.params.id;
    const adminId = req.userId;
    
    // Verify admin
    db.get(`
        SELECT * FROM league_settings WHERE league_id = ? AND admin_id = ?
    `, [leagueId, adminId], (err, admin) => {
        if (!admin) {
            return res.status(403).json({ message: 'Only league admin can view this' });
        }
        
        // Get pending individual members
        db.all(`
            SELECT lm.*, u.username, u.email, p.amount as payment_amount, p.status as payment_status
            FROM league_members lm
            LEFT JOIN users u ON lm.user_id = u.id
            LEFT JOIN payments p ON (p.league_id = ? AND p.user_id = u.id)
            WHERE lm.league_id = ? AND lm.status = 'pending'
        `, [leagueId, leagueId], (err, members) => {
            if (err) return res.status(500).json({ message: 'Error fetching pending approvals' });
            // now fetch pending team participants
            db.all(`
                SELECT lp.*, t.name as team_name, u.username as leader_name, p.amount as payment_amount, p.status as payment_status
                FROM league_participants lp
                LEFT JOIN teams t ON lp.team_id = t.id
                LEFT JOIN users u ON t.leader_id = u.id
                LEFT JOIN payments p ON (p.league_id = ? AND p.team_id = lp.team_id)
                WHERE lp.league_id = ? AND lp.status = 'pending'
            `, [leagueId, leagueId], (err2, teams) => {
                if (err2) return res.status(500).json({ message: 'Error fetching pending team participants' });
                res.json({ pending_members: members || [], pending_teams: teams || [] });
            });
        });
    });
});

// Admin: update required participant count for draws
app.put('/api/leagues/:id/set-required-participants', verifyToken, (req, res) => {
    const leagueId = req.params.id;
    const { required_participants, players_per_group } = req.body;
    const adminId = req.userId;

    if (typeof required_participants !== 'number' || required_participants < 0) {
        return res.status(400).json({ message: 'Required participant count must be a non-negative number' });
    }

    // verify admin
    db.get(`SELECT * FROM league_settings WHERE league_id = ? AND admin_id = ?`, [leagueId, adminId], (err, admin) => {
        if (err || !admin) {
            return res.status(403).json({ message: 'Only league admin can update draw settings' });
        }

        // update draw_status and optionally players_per_group
        db.run(`UPDATE league_draw_status SET required_participants = ? WHERE league_id = ?`,
            [required_participants, leagueId], function(err2) {
                if (err2) return res.status(500).json({ message: 'Error updating required participants' });
                // if a new group size was provided, update league_settings
                if (typeof players_per_group === 'number' && players_per_group > 0) {
                    db.run(`UPDATE league_settings SET players_per_group = ? WHERE league_id = ?`,
                        [players_per_group, leagueId], () => {});
                }
                // after updating, check if draw conditions are already met
                checkAndPerformDraw(leagueId);
                res.json({ message: 'Required participants updated' });
            });
    });
});

// Admin or member: get draw status for league
app.get('/api/leagues/:id/draw-status', verifyToken, (req, res) => {
    const leagueId = req.params.id;
    // no admin check; any member can view
    db.get(`SELECT * FROM league_draw_status WHERE league_id = ?`, [leagueId], (err, row) => {
        if (err) return res.status(500).json({ message: 'Error fetching draw status' });
        res.json({ draw_status: row || {} });
    });
});

// Admin or member: get draw results for a league (optionally by draw_number)
app.get('/api/leagues/:id/draws', verifyToken, (req, res) => {
    const leagueId = req.params.id;
    const drawNumber = req.query.draw_number ? parseInt(req.query.draw_number) : null;
    // join usernames for readability
    let query = `
        SELECT ld.draw_number, ld.match_order, ld.group_number,
               ld.participant_1_id, u1.username as participant_1_name,
               ld.participant_2_id, u2.username as participant_2_name
        FROM league_draws ld
        LEFT JOIN users u1 ON ld.participant_1_id = u1.id
        LEFT JOIN users u2 ON ld.participant_2_id = u2.id
        WHERE ld.league_id = ?`;
    const params = [leagueId];
    if (drawNumber) {
        query += ` AND ld.draw_number = ?`;
        params.push(drawNumber);
    }
    query += ` ORDER BY ld.draw_number, ld.match_order`;
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error fetching draw results' });
        res.json({ draws: rows || [] });
    });
});

// Delete league (admin only)
app.delete('/api/leagues/:id', verifyToken, (req, res) => {
    const leagueId = req.params.id;
    const userId = req.userId;
    
    // ensure requester is admin/creator
    db.get(`SELECT * FROM league_settings WHERE league_id = ? AND admin_id = ?`, [leagueId, userId], (err, row) => {
        if (err || !row) {
            return res.status(403).json({ message: 'Only league creator can delete this league' });
        }
        
        // cascade delete related records
        const tables = [
            'league_settings', 'league_members', 'league_participants', 'league_formats',
            'payments', 'matches', 'match_results', 'tournament_brackets', 'tournament_participants',
            'creator_accounts', 'prize_distribution', 'prize_payments', 'chat_messages',
            'league_standings', 'player_statistics'
        ];
        tables.forEach(tbl => {
            db.run(`DELETE FROM ${tbl} WHERE league_id = ?`, [leagueId], () => {});
        });
        db.run(`DELETE FROM leagues WHERE id = ?`, [leagueId], function(err) {
            if (err) return res.status(500).json({ message: 'Error deleting league' });
            res.json({ message: 'League deleted successfully' });
        });
    });
});

// Record Payment
app.post('/api/payments/record', verifyToken, (req, res) => {
    const { league_id, team_id, amount, payment_method, transaction_id } = req.body;
    const userId = req.userId;
    
    db.run(`
        UPDATE payments SET status = 'confirmed', payment_method = ?, transaction_id = ?
        WHERE user_id = ? AND league_id = ?${team_id ? ' AND team_id = ?' : ''}
    `, team_id ? [payment_method, transaction_id, userId, league_id, team_id] : [payment_method, transaction_id, userId, league_id], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Error recording payment' });
        }
        
        res.json({ message: 'Payment recorded successfully' });
    });
});

// Endpoint for removing a pending join request (admin or self)
app.delete('/api/leagues/:id/requests', verifyToken, (req, res) => {
    const leagueId = req.params.id;
    const { user_id, team_id } = req.body;
    const userId = req.userId;

    // allow either admin or the requester themselves to remove
    if (user_id && user_id !== userId) {
        // only admin
        db.get(`SELECT * FROM league_settings WHERE league_id = ? AND admin_id = ?`, [leagueId, userId], (err, row) => {
            if (err || !row) {
                return res.status(403).json({ message: 'Not authorized to reject this request' });
            }
            db.run(`DELETE FROM league_members WHERE league_id = ? AND user_id = ? AND status = 'pending'`, [leagueId, user_id], function(err) {
                if (err) return res.status(500).json({ message: 'Error rejecting request' });
                res.json({ message: 'Request rejected' });
            });
        });
    } else if (team_id) {
        db.get(`SELECT * FROM league_settings WHERE league_id = ? AND admin_id = ?`, [leagueId, userId], (err, row) => {
            if (err || !row) {
                return res.status(403).json({ message: 'Not authorized to reject this request' });
            }
            db.run(`DELETE FROM league_participants WHERE league_id = ? AND team_id = ? AND status = 'pending'`, [leagueId, team_id], function(err) {
                if (err) return res.status(500).json({ message: 'Error rejecting request' });
                res.json({ message: 'Request rejected' });
            });
        });
    } else {
        // self-cancellation not implemented for teams here
        res.status(400).json({ message: 'Missing identifier' });
    }
});

// Get League Payments (Admin only)
app.get('/api/leagues/:id/payments', verifyToken, (req, res) => {
    const leagueId = req.params.id;
    const adminId = req.userId;
    
    // Verify admin
    db.get(`
        SELECT * FROM league_settings WHERE league_id = ? AND admin_id = ?
    `, [leagueId, adminId], (err, admin) => {
        if (!admin) {
            return res.status(403).json({ message: 'Only league admin can view payments' });
        }
        
        // Get all payments for this league
        db.all(`
            SELECT p.*, u.username, u.email, t.name as team_name
            FROM payments p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN teams t ON p.team_id = t.id
            WHERE p.league_id = ?
            ORDER BY p.created_at DESC
        `, [leagueId], (err, payments) => {
            if (err) return res.status(500).json({ message: 'Error fetching payments' });
            res.json({ payments: payments || [] });
        });
    });
});

// Update Payment Status (Admin only)
app.put('/api/payments/:id/status', verifyToken, (req, res) => {
    const paymentId = req.params.id;
    const { status } = req.body;
    const adminId = req.userId;
    
    // Get payment and verify admin
    db.get(`
        SELECT p.*, ls.admin_id
        FROM payments p
        JOIN league_settings ls ON p.league_id = ls.league_id
        WHERE p.id = ? AND ls.admin_id = ?
    `, [paymentId, adminId], (err, payment) => {
        if (!payment) {
            return res.status(403).json({ message: 'Only league admin can update payment status' });
        }
        
        db.run(`
            UPDATE payments SET status = ? WHERE id = ?
        `, [status, paymentId], function(err) {
            if (err) {
                return res.status(500).json({ message: 'Error updating payment status' });
            }
            
            res.json({ message: 'Payment status updated successfully' });
        });
    });
});

// ============= TOURNAMENT BRACKET ENDPOINTS =============

// Create Tournament Bracket (Admin only)
app.post('/api/leagues/:id/bracket/create', verifyToken, (req, res) => {
    const leagueId = req.params.id;
    const adminId = req.userId;

    // Verify admin
    db.get(`SELECT * FROM league_settings WHERE league_id = ? AND admin_id = ?`, 
        [leagueId, adminId], (err, admin) => {
        if (!admin) {
            return res.status(403).json({ message: 'Only league admin can create bracket' });
        }

        // Get all approved members
        db.all(`
            SELECT lm.user_id FROM league_members lm
            WHERE lm.league_id = ? AND lm.status = 'approved'
        `, [leagueId], (err, members) => {
            if (!members || members.length === 0) {
                return res.status(400).json({ message: 'No approved members to create bracket' });
            }

            const totalParticipants = members.length;
            let brackets = {
                32: 'round-32',
                16: 'round-16',
                8: 'quarterfinals',
                4: 'semifinals',
                2: 'final'
            };

            // Determine starting round based on participants
            let startingRound = 'round-32';
            if (totalParticipants < 32) startingRound = 'round-16';
            if (totalParticipants < 16) startingRound = 'quarterfinals';
            if (totalParticipants < 8) startingRound = 'semifinals';

            // Create tournament bracket
            db.run(`
                INSERT INTO tournament_brackets (league_id, format, total_participants, current_round)
                VALUES (?, 'knockout-32', ?, ?)
            `, [leagueId, totalParticipants, startingRound], function(err) {
                if (err) {
                    return res.status(500).json({ message: 'Error creating bracket' });
                }

                const bracketId = this.lastID;

                // Add participants with seeds
                let seedCounter = 1;
                members.forEach(member => {
                    db.run(`
                        INSERT INTO tournament_participants (bracket_id, user_id, seed)
                        VALUES (?, ?, ?)
                    `, [bracketId, member.user_id, seedCounter++]);
                });

                res.json({
                    message: 'Tournament bracket created successfully',
                    bracketId: bracketId,
                    totalParticipants: totalParticipants,
                    startingRound: startingRound
                });
            });
        });
    });
});

// Get Tournament Bracket
app.get('/api/leagues/:id/bracket', (req, res) => {
    const leagueId = req.params.id;

    db.get(`SELECT * FROM tournament_brackets WHERE league_id = ?`, 
        [leagueId], (err, bracket) => {
        if (err || !bracket) {
            return res.status(404).json({ message: 'Tournament bracket not found' });
        }

        // Get bracket structure with matches by round
        const rounds = ['round-32', 'round-16', 'quarterfinals', 'semifinals', 'final'];
        const bracketData = {
            bracket: bracket,
            rounds: {}
        };

        // Fetch matches for each round
        rounds.forEach(round => {
            db.all(`
                SELECT m.*, u1.username as player1_name, u2.username as player2_name,
                       mr.score_team_1, mr.score_team_2, mr.status as result_status
                FROM matches m
                LEFT JOIN users u1 ON m.user_1_id = u1.id
                LEFT JOIN users u2 ON m.user_2_id = u2.id
                LEFT JOIN match_results mr ON m.id = mr.match_id
                WHERE m.league_id = ? AND m.round = ?
                ORDER BY m.match_number
            `, [leagueId, round], (err, matches) => {
                bracketData.rounds[round] = matches || [];
            });
        });

        // Return bracket data (note: async operation may not be complete)
        setTimeout(() => {
            res.json(bracketData);
        }, 100);
    });
});

// Generate First Round Matches
app.post('/api/leagues/:id/bracket/generate-matches', verifyToken, (req, res) => {
    const leagueId = req.params.id;
    const adminId = req.userId;

    // Verify admin
    db.get(`SELECT * FROM league_settings WHERE league_id = ? AND admin_id = ?`, 
        [leagueId, adminId], (err, admin) => {
        if (!admin) {
            return res.status(403).json({ message: 'Only league admin can generate matches' });
        }

        // Get bracket
        db.get(`SELECT * FROM tournament_brackets WHERE league_id = ?`, 
            [leagueId], (err, bracket) => {
            if (!bracket) {
                return res.status(404).json({ message: 'Tournament bracket not found' });
            }

            // Get all seeded participants
            db.all(`
                SELECT * FROM tournament_participants WHERE bracket_id = ? ORDER BY seed
            `, [bracket.id], (err, participants) => {
                if (err || !participants) {
                    return res.status(500).json({ message: 'Error fetching participants' });
                }

                // Create matches by pairing seeded participants
                const matchesCreated = [];
                let matchNumber = 1;

                for (let i = 0; i < participants.length; i += 2) {
                    if (i + 1 < participants.length) {
                        db.run(`
                            INSERT INTO matches (
                                league_id, match_number, user_1_id, user_2_id,
                                seed_1, seed_2, round, stage, status
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Round of ${participants.length}', 'scheduled')
                        `, [
                            leagueId,
                            matchNumber,
                            participants[i].user_id,
                            participants[i + 1].user_id,
                            participants[i].seed,
                            participants[i + 1].seed,
                            bracket.current_round
                        ]);
                        matchNumber++;
                    }
                }

                res.json({
                    message: 'Matches generated successfully',
                    matchesCreated: Math.floor(participants.length / 2)
                });
            });
        });
    });
});

// Advance Winner to Next Round
app.post('/api/matches/:id/advance-winner', verifyToken, (req, res) => {
    const matchId = req.params.id;
    const { winnerId } = req.body;
    const adminId = req.userId;

    db.get(`SELECT m.* FROM matches m 
            JOIN league_settings ls ON m.league_id = ls.league_id
            WHERE m.id = ? AND ls.admin_id = ?`, 
        [matchId, adminId], (err, match) => {
        if (err || !match) {
            return res.status(403).json({ message: 'Only league admin can advance winners' });
        }

        if (!winnerId) {
            return res.status(400).json({ message: 'Winner ID is required' });
        }

        // Update match with winner
        db.run(`UPDATE matches SET winner_id = ? WHERE id = ?`, 
            [winnerId, matchId], (err) => {
            if (err) {
                return res.status(500).json({ message: 'Error updating match' });
            }

            res.json({ message: 'Winner advanced successfully' });
        });
    });
});

// Chat Endpoints
// Send message to league chat
app.post('/api/leagues/:id/chat', verifyToken, (req, res) => {
    const leagueId = req.params.id;
    const userId = req.userId;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
        return res.status(400).json({ message: 'Message cannot be empty' });
    }

    // Check if user is a member of the league
    db.get(`SELECT * FROM league_members WHERE league_id = ? AND user_id = ?`, 
        [leagueId, userId], (err, member) => {
        if (!member) {
            return res.status(403).json({ message: 'You are not a member of this league' });
        }

        // Insert message
        db.run(
            `INSERT INTO chat_messages (league_id, user_id, message) VALUES (?, ?, ?)`,
            [leagueId, userId, message.trim()],
            function(err) {
                if (err) {
                    return res.status(500).json({ message: 'Error sending message' });
                }

                res.json({
                    message: 'Message sent successfully',
                    messageId: this.lastID
                });
            }
        );
    });
});

// Check if user is an approved member of league and whether they have a pending request
app.get('/api/leagues/:id/check-member', verifyToken, (req, res) => {
    const leagueId = req.params.id;
    const userId = req.userId;

    // First check league game type
    db.get(`SELECT game FROM leagues WHERE id = ?`, [leagueId], (err, league) => {
        if (err || !league) {
            return res.status(404).json({ message: 'League not found' });
        }

        if (league.game === 'eFootball') {
            db.get(`SELECT status FROM league_members WHERE league_id = ? AND user_id = ?`,
                [leagueId, userId], (err, row) => {
                    res.json({
                        isMember: row?.status === 'approved',
                        isPending: row?.status === 'pending'
                    });
                });
        } else {
            // for team-based, need to check that the user has a participant record
            db.get(`SELECT status FROM league_participants WHERE league_id = ? AND user_id = ?`,
                [leagueId, userId], (err, row) => {
                    res.json({
                        isMember: row?.status === 'approved',
                        isPending: row?.status === 'pending'
                    });
                });
        }
    });
});

// Get league members
app.get('/api/leagues/:id/members', verifyToken, (req, res) => {
    const leagueId = req.params.id;

    db.all(`
        SELECT u.id, u.username, u.profile_picture, lm.joined_at
        FROM league_members lm
        JOIN users u ON lm.user_id = u.id
        WHERE lm.league_id = ?
        ORDER BY lm.joined_at DESC
    `, [leagueId], (err, members) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching members' });
        }

        res.json({
            members: members || []
        });
    });
});

// Get league chat messages
app.get('/api/leagues/:id/chat', verifyToken, (req, res) => {
    const leagueId = req.params.id;
    const userId = req.userId;
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;

    // Check if user is a member of the league
    db.get(`SELECT * FROM league_members WHERE league_id = ? AND user_id = ?`, 
        [leagueId, userId], (err, member) => {
        if (!member) {
            return res.status(403).json({ message: 'You are not a member of this league' });
        }

        // Get messages with user details
        db.all(
            `SELECT cm.id, cm.league_id, cm.user_id, cm.message, cm.created_at, u.username, u.profile_picture
             FROM chat_messages cm
             JOIN users u ON cm.user_id = u.id
             WHERE cm.league_id = ?
             ORDER BY cm.created_at DESC
             LIMIT ? OFFSET ?`,
            [leagueId, limit, offset],
            (err, messages) => {
                if (err) {
                    return res.status(500).json({ message: 'Error fetching messages' });
                }

                res.json({
                    messages: messages.reverse(),  // Reverse to show chronological order
                    total: messages.length
                });
            }
        );
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/leagues.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'leagues.html'));
});

app.get('/payment.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'payment.html'));
});

app.get('/profile-settings.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile-settings.html'));
});

app.get('/teams.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'teams.html'));
});

app.get('/tournament-bracket.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tournament-bracket.html'));
});

app.get('/league-chat.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'league-chat.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔════════════════════════════════════════╗
    ║      GameHub Server Running 🎮        ║
    ║     http://localhost:${PORT}           ║
    ╚════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close();
    console.log('Database closed');
    process.exit(0);
});

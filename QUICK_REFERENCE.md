# GameHub Features - Quick Reference

## 🎮 Game Types & Features Matrix

| Feature | eFootball | Call of Duty |
|---------|-----------|--------------|
| Team Registration | ✅ Create | ✅ Create & Join |
| League Participation | Individual Players | Teams |
| Join Method | Direct to League | Team → League |
| Formats | Group Stage, Knockout, Round Robin | Tournament |
| Entry Fee | 3000 TSH/player | 3000 TSH/member |
| Match Scheduling | Group → Knockout → Final | Bracket-based |
| Result Upload | Yes (with screenshot) | Yes (with evidence) |
| Admin Approval | Per applicant | Per team/member |
| Venue Types | Online/Physical | Any |

## 📋 League Formats Explained

### Group Stage (16 or 32)
- Players divided into multiple groups (default 4 per group)
- Round-robin within groups
- Top teams advance to knockout
- Best for: Large tournaments with balance

### Knockout (16 or 32)
- Direct elimination bracket
- Winners advance
- Single loss = elimination
- Best for: Competitive, fastest format

### Round Robin (8-16)
- Every player plays every other player
- Full ranking at end
- Longest format
- Best for: Fair ranking, small leagues

## 💰 Payment Flow

```
Player Joins League
        ↓
3000 TSH Entry Fee
        ↓
Payment Status: PENDING
        ↓
Admin Approves Player
        ↓
Payment Status: CONFIRMED
        ↓
Player Can Compete
```

## 👤 User Roles

### Regular Player
- Create profile
- Join leagues (pending approval)
- Submit match results
- Pay entry fees
- View standings

### Team Leader (CoD)
- Create team
- Accept/reject join requests
- Register team for leagues
- Pay team entry fee
- Manage team members

### League Admin
- Create and manage leagues
- Approve/reject member applications
- Create and schedule matches
- Review and approve results
- Manage payments
- View all statistics

## 🔄 Player Registration Flow

### eFootball
```
Login → Browse Leagues → Find eFootball League
    ↓
Click "Join League" → Select Payment Method → Pay 3000 TSH
    ↓
Status: PENDING APPROVAL
    ↓
Admin Reviews & Approves
    ↓
Status: APPROVED - Ready to Compete
```

### Call of Duty
```
Login → Create/Join Team → Team Shows Available Leagues
    ↓
Team Leader Registers League → Pay 3000 TSH per member
    ↓
Status: PENDING APPROVAL
    ↓
Admin Reviews & Approves
    ↓
Status: APPROVED - Team Can Compete
```

## 📊 Admin Dashboard Sections

### 1. Overview
- League stats (participants, matches)
- Quick actions
- League details
- Status

### 2. Members
- Pending approvals (approve/reject)
- Approved members list
- Payment status per member
- Join dates

### 3. Matches
- Create new matches
- Assign stages
- Schedule (date/time/venue)
- View match list
- Track match status

### 4. Results
- Submitted results (pending approval)
- Score validation
- Evidence review
- Approve/reject
- Update final standings

### 5. Payments
- Payment records
- Amount tracking
- Payment status
- Transaction IDs
- Payment method types

## 🔐 Key Security Rules

1. **Admin Operations Require:**
   - Valid JWT token
   - Admin role for that league
   - Correct league ownership

2. **Member Operations Require:**
   - Valid JWT token
   - Active membership
   - Payment confirmation

3. **Result Submission Requires:**
   - Match participant
   - Valid score format
   - Evidence attachment

## 🌐 Page Navigation Map

```
index.html (Home)
    ↓
├── login.html (Authentication)
├── leagues.html (League Hub)
│   └── league-create.html (Create League - Admin)
│   └── leagues-join.html (Browse & Join)
│   └── league-manage.html?id=X (Admin Panel)
├── match-result.html?matchId=X (Submit Result)
├── teams.html (Team Hub)
├── dashboard.html (User Dashboard)
└── (Other existing pages)
```

## 📱 Mobile Responsiveness

All new pages are responsive with:
- Mobile-first design
- Breakpoints at 1024px and 600px
- Touch-friendly buttons
- Readable fonts on small screens

## 🎯 Common User Tasks

### Create a League
1. Login as admin
2. Go to league-create.html
3. Fill form → Select format → Set fee
4. Submit → Get league ID
5. Share league link with players

### Join a League
1. Browse leagues at leagues-join.html
2. Click join → Pick payment method
3. Confirm → Wait for admin approval
4. Once approved, view matches

### Submit Match Result
1. Click "Submit Result" from dashboard
2. Enter final scores
3. Upload screenshot/evidence
4. Add description (optional)
5. Submit → Wait for admin approval

### Approve Members (Admin)
1. Go to league-manage.html
2. Click "Members" tab
3. Review pending applicants
4. Click "Approve" for each
5. Member becomes active

### Draws (eFootball leagues)
- After all member requests are approved and the required participant count is met, the system automatically performs a random draw pairing players.
- Use the "Draw Status" section (admins) to set or adjust the required participant count and players‑per‑group value (default 4) before members finish joining.
- Draw results appear under the "Draws" tab when generated.

## 🔗 Important API Endpoints

**Create League:** `POST /api/leagues/create`
**Join League:** `POST /api/leagues/{id}/join-efootball`
**Create Match:** `POST /api/matches/create`
**Submit Result:** `POST /api/matches/{id}/result`
**Approve Result:** `PUT /api/matches/{id}/approve-result`
**Approve Member:** `PUT /api/leagues/{id}/approve-member`
**Set Required Participants:** `PUT /api/leagues/{id}/set-required-participants` (admin) – body may include `players_per_group` to change grouping size.
**View Draw Status:** `GET /api/leagues/{id}/draw-status`
**Fetch Draw Results:** `GET /api/leagues/{id}/draws` (optional `?draw_number=`)

## 📈 Success Metrics

Track these to measure platform health:

- Total leagues created
- Total players registered
- Total payments collected (3000 TSH × registrations)
- Match completion rate
- Admin approval speed (target: <24hrs)
- Player satisfaction (feedback)
- League retention rate

## 🛠️ Troubleshooting Checklist

- [ ] Server running (npm start)?
- [ ] Token valid for admin operations?
- [ ] Database tables created (check gamehub.db)?
- [ ] League ID correct in URL?
- [ ] Payment fee = 3000 TSH?
- [ ] Member status = 'approved'?
- [ ] Match in correct stage?
- [ ] Evidence uploaded for results?

## 📞 Contact & Support

For issues:
1. Check IMPLEMENTATION_GUIDE.md
2. Review LEAGUE_FEATURES.md
3. Check database queries in guide
4. Verify API endpoints
5. Check browser console for errors

---

**Last Updated:** March 2026
**Version:** 1.0
**Platform:** GameHub Advanced League Management System

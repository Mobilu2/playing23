# GameHub - Advanced League & Team Management System

## Overview

This document describes the new advanced features added to the GameHub platform for managing competitive leagues and teams in **eFootball** and **Call of Duty Mobile**.

## New Features

### 1. **League Creation** (for admins)
**Page:** `league-create.html`

Admins can create new competitive leagues with:
- **League Name & Description**: Define the league identity
- **Game Selection**: Choose between eFootball or Call of Duty
- **Format Selection**:
  - Group Stage (16 or 32 members, groups of 4 by default)
  - Knockout Tournament (16 or 32 members)
  - Round Robin (8-16 members)
- **Players per Group**: For group stage leagues, you can specify how many participants should be in each group (default 4)
- **Max Participants**: Set league size limit
- **Entry Fee**: Default 3000 TSH (customizable)
- **Prize Pool**: Define prize distribution (e.g., 1st: 50%, 2nd: 30%, 3rd: 20%)

**Key Points:**
- League creator becomes Admin
- Admin controls all approvals, match creation, and result validation
- Entry fee is required for all participants

### 2. **Team Registration**

#### For Call of Duty:
- Users can **create teams** (team leader)
- Other users can **join Call of Duty teams**
- Entry fee: 3000 TSH per member joining a team in a league
- Team leaders manage team members

#### For eFootball:
- Individual players **join leagues directly** (no team structure)
- Entry fee: 3000 TSH per player per league
- Admin approves individual participants

### 3. **League Management Panel** 
**Page:** `league-manage.html`

Admin dashboard for league administrators featuring:

#### Overview Tab:
- League statistics (participants, matches, fees)
- Quick action buttons
- League information display

#### Members Tab:
- View pending approvals
- View approved members
- Approve/Reject member applications
- Payment status tracking

#### Matches Tab:
- Create new matches
- Assign stages (Group Stage → Knockout → Semi-Final → Final)
- Schedule match date, time, and venue
- View all scheduled matches
- Track match status

#### Results Tab:
- Approve/reject submitted results
- Review match scores
- View evidence/screenshots

#### Payments Tab:
- Track payment status for all participants
- View payment records
- Payment method tracking

### 4. **Match Scheduling & Management**

Admins can:
- Create matches for scheduled dates
- Assign stages (group stage, knockout rounds, finals)
- Set venues and times
- Assign participants/teams

Match lifecycle:
1. **Scheduled** - Match created
2. **Completed** - Result submitted and approved
3. **Can be reversed** - For error correction

### 5. **Results Upload**
**Page:** `match-result.html`

Participants can:
- Submit match final scores
- Add match details/description
- Upload screenshot as proof
- Submit results for admin review

Admin workflow:
1. Review submitted results
2. Approve/reject based on evidence
3. Confirm final standings

### 6. **League Joining**
**Page:** `leagues-join.html`

Players can:
- Browse available leagues
- Filter by game and status
- See league details (format, fee, participants)
- Join league with entry fee payment
- Track payment status

### 7. **Payment Management**

Features:
- Entry fee tracking (3000 TSH)
- Payment methods:
  - Mobile Money
  - Bank Transfer
  - Cash Payment
- Payment status:
  - Pending (awaiting verification)
  - Confirmed (approved by admin)
- Transaction ID tracking

## Database Schema

### New Tables

#### `league_members`
Tracks individual participants in eFootball leagues
- `league_id`: Foreign key to leagues
- `user_id`: Participant user
- `status`: pending/approved
- `payment_status`: unpaid/paid/confirmed

#### `league_settings`
Admin configurations for each league
- `league_id`: League identifier
- `admin_id`: Admin user ID
- `entry_fee`: League entry fee (3000 TSH default)
- `game`: Game type (efootball/cod)
- `format`: Tournament format
- `max_participants`: Capacity limit
- `players_per_group`: Number of participants assigned to each group (used when `format` is a group stage; default 4)
- `status`: open/closed

#### `league_formats`
Defines tournament structure
- `league_id`: Associated league
- `format_type`: Tournament format
- `max_participants`: Format capacity
- `stage`: Current stage
- `description`: Format description

#### `matches`
Individual matches in a league
- `league_id`: Parent league
- `match_number`: Match sequence
- `team_1_id` / `team_2_id`: Participants
- `stage`: group-stage/knockout/semi-final/final
- `scheduled_date`: Match date
- `scheduled_time`: Match time
- `venue`: Physical or online venue
- `status`: scheduled/completed/cancelled
- `winner_id`: Result winner

#### `match_results`
Result submissions and approvals
- `match_id`: Associated match
- `score_team_1` / `score_team_2`: Final score
- `submitted_by`: User who submitted
- `screenshot_url`: Evidence
- `status`: pending/approved/rejected
- `approved_by`: Admin who approved

#### `payments`
Payment tracking
- `user_id`: Payer
- `league_id`: Associated league
- `amount`: Entry fee amount
- `currency`: TSH
- `payment_method`: Method used
- `status`: pending/confirmed/paid
- `transaction_id`: Payment reference

## API Endpoints

### League Management
- `POST /api/leagues/create` - Create new league
- `GET /api/leagues/details/:id` - Get league details
- `GET /api/leagues/:id/matches` - Get league matches

### Joining
- `POST /api/leagues/:id/join-efootball` - Join eFootball league
- `POST /api/teams/:id/join-cod` - Join Call of Duty team

### Match Management
- `POST /api/matches/create` - Create match (admin)
- `GET /api/leagues/:id/matches` - List matches

### Results
- `POST /api/matches/:id/result` - Submit result
- `PUT /api/matches/:id/approve-result` - Approve result (admin)

### Admin
- `GET /api/leagues/:id/pending-approvals` - Get pending approvals (includes individuals and team requests)
- `PUT /api/leagues/:id/approve-member` - Approve member or team participant (admin)
- `PUT /api/leagues/:id/set-required-participants` - Set expected number of participants for random draw (admin)
- `GET /api/leagues/:id/draw-status` - Retrieve current draw status (required/current/triggered)
- `GET /api/leagues/:id/draws` - Retrieve generated draw pairings
- `DELETE /api/leagues/:id` - Delete a league (admin/creator)
- `DELETE /api/leagues/:id/requests` - Remove a pending join request

### Payments
- `POST /api/payments/record` - Record payment

## Workflow Examples

### eFootball League Workflow

1. **Setup Phase:**
   - Admin creates league with 32-member group stage format
   - Sets required participant count (or leave default max)
   - Sets entry fee to 3000 TSH
   - Specifies progression: Group Stage → Knockout → Finals

2. **Registration Phase:**
   - Players join league
   - Pay 3000 TSH entry fee
   - Admin approves pending applications
   - Once all requests are approved and the required count is reached, the system automatically performs a random draw pairing players for the first round

3. **League Phase:**
   - Admin creates matches with stages
   - Players submit results with screenshots
   - Admin reviews and approves
   - Standings update automatically

2. **Registration Phase:**
   - Players join league
   - Pay 3000 TSH entry fee
   - Admin approves pending applications

3. **League Phase:**
   - Admin creates matches with stages
   - Players submit results with screenshots
   - Admin reviews and approves
   - Standings update automatically

4. **Final Phase:**
   - Knockout rounds generated after group stage
   - Winners advance to next stage
   - Final match determines champion

### Call of Duty Workflow

1. **Team Setup:**
   - Team leader creates team
   - Members join team (3000 TSH per member if in league)

2. **League Entry:**
   - Team leader registers team for league
   - Pays 3000 TSH entry fee
   - Admin approves team

3. **Competition:**
   - Admin creates team matches
   - Team members play matches
   - Results submitted with video evidence
   - Admin approves and awards points

## Security & Validation

- JWT authentication required for all admin operations
- Admins can only manage their own leagues
- Entry fees validated before payment confirmation
- Results require evidence (screenshot/video)
- Member approvals controlled by league admin

## Fee Structure

**Entry Fee:** 3000 TSH (per player/per team)

Usage:
- Prize pool distribution
- Platform maintenance
- League administration costs

Payment methods accepted:
- Mobile Money (M-Pesa, Airtel Money, etc.)
- Bank Transfer
- Direct Cash Payment

## Future Enhancements

- Bracket generation automation
- Live score tracking
- Real-time notifications
- Video result uploads
- Advanced statistics dashboard
- Betting/odds system
- Team merchandise store
- Sponsorship partnerships

## Support

For issues or questions about the new features:
1. Check the dashboard help section
2. Contact the league admin
3. Reach out to GameHub support team

---

**Version:** 1.0  
**Last Updated:** March 2026  
**Status:** Active

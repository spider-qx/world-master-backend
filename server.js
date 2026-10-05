const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let database = {
    users: [], // Stores user accounts: { username, password }
    universes: [
        {
            id: "default_world",
            name: "Premier Elite Universe",
            admin: "Spider23qX",
            laws: "1. Financial Fair Play active.\n2. Transfer caps enforced by Aya.",
            activeTournament: "World Master League Cup",
            matchday: 1,
            newsletters: ["📰 [FA Gazette]: Welcome to the Premier Elite Universe."],
            transferMarket: [
                { id: 101, name: "Mateo Fernandez", pos: "RW", age: 21, ovr: 83, price: 16000000 },
                { id: 102, name: "Pep Lijnders", pos: "Head Coach", age: 43, ovr: 85, price: 5000000 }
            ],
            clubs: {},
            matchesLog: []
        }
    ]
};

// --- USER AUTHENTICATION ROUTES ---
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required." });
    
    let existing = database.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existing) return res.status(400).json({ error: "Username already taken." });

    database.users.push({ username, password });
    res.json({ success: true, message: "Account created successfully!" });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    let user = database.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (!user) return res.status(400).json({ error: "Invalid username or password." });

    res.json({ success: true, username: user.username });
});

// --- UNIVERSE & CLUB ROUTES ---
app.get('/api/universes', (req, res) => {
    res.json(database.universes);
});

app.post('/api/universes', (req, res) => {
    const { name, admin } = req.body;
    const newId = "world_" + Date.now();
    
    const newWorld = {
        id: newId,
        name,
        admin,
        laws: "1. FFP Active.\n2. Fair Bidding enforced by Aya.",
        activeTournament: "Inaugural Universe Cup",
        matchday: 1,
        newsletters: [`📰 [FA Gazette]: Universe '${name}' created by ${admin}.`],
        transferMarket: [
            { id: Date.now() + 1, name: "Mikel Arteta Jr", pos: "Head Coach", age: 44, ovr: 88, price: 7000000 }
        ],
        clubs: {},
        matchesLog: []
    };

    database.universes.push(newWorld);
    res.json({ success: true, world: newWorld });
});

// Join or Load Club via User Account
app.post('/api/universes/:worldId/join', (req, res) => {
    const { worldId } = req.params;
    const { username, clubName } = req.body;

    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "Universe not found" });

    let clubKey = clubName.toLowerCase().replace(/\s+/g, '_');

    // Check if club is already owned by someone else
    if (world.clubs[clubKey] && world.clubs[clubKey].owner !== username) {
        return res.status(400).json({ error: "This club name is already owned by another manager!" });
    }

    if (!world.clubs[clubKey]) {
        world.clubs[clubKey] = {
            name: clubName,
            owner: username,
            budget: 35000000,
            stadiumCap: 40000,
            points: 0,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            gf: 0,
            ga: 0,
            coach: { name: "Unassigned", rating: 0 },
            squad: [
                { name: "Starter Striker", pos: "ST", age: 24, ovr: 78, wage: 20000 }
            ]
        };
    }

    res.json({ success: true, world, clubKey });
});

// --- ADVANCED MATCH SIMULATOR ENGINE ---
app.post('/api/universes/:worldId/simulate', (req, res) => {
    const { worldId } = req.params;
    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "Universe not found" });

    let clubKeys = Object.keys(world.clubs);
    if (clubKeys.length < 2) {
        return res.status(400).json({ error: "Need at least 2 clubs in the universe to simulate matchdays!" });
    }

    let matchDaySummary = `=== MATCHDAY ${world.matchday} SIMULATION ===\n`;

    // Simulate fixtures between paired clubs
    for (let i = 0; i < clubKeys.length; i += 2) {
        if (i + 1 < clubKeys.length) {
            let homeKey = clubKeys[i];
            let awayKey = clubKeys[i+1];
            let home = world.clubs[homeKey];
            let away = world.clubs[awayKey];

            // Engine calculation using squad rating + coach impact
            let homePower = home.squad.reduce((sum, p) => sum + p.ovr, 0) / (home.squad.length || 1) + home.coach.rating;
            let awayPower = away.squad.reduce((sum, p) => sum + p.ovr, 0) / (away.squad.length || 1) + away.coach.rating;

            let homeGoals = Math.max(0, Math.floor((homePower / 35) + (Math.random() * 2) - 0.8));
            let awayGoals = Math.max(0, Math.floor((awayPower / 35) + (Math.random() * 2) - 0.8));

            // Adjust table stats
            home.played++; away.played++;
            home.gf += homeGoals; home.ga += awayGoals;
            away.gf += awayGoals; away.ga += homeGoals;

            if (homeGoals > awayGoals) {
                home.won++; home.points += 3;
                away.lost++;
            } else if (homeGoals < awayGoals) {
                away.won++; away.points += 3;
                home.lost++;
            } else {
                home.drawn++; home.points += 1;
                away.drawn++; away.points += 1;
            }

            matchDaySummary += `⚽ ${home.name} ${homeGoals} - ${awayGoals} ${away.name}\n`;
        }
    }

    world.matchesLog.unshift(matchDaySummary);
    world.matchday++;

    res.json({ success: true, world });
});

// Transfer & Admin actions
app.post('/api/universes/:worldId/transfer', (req, res) => {
    const { worldId } = req.params;
    const { clubKey, itemId } = req.body;
    let world = database.universes.find(w => w.id === worldId);
    let club = world.clubs[clubKey];
    let itemIndex = world.transferMarket.findIndex(i => i.id === itemId);

    if (itemIndex === -1) return res.status(400).json({ error: "Item already signed." });
    let item = world.transferMarket[itemIndex];
    if (club.budget < item.price) return res.status(400).json({ error: "Insufficient funds." });

    club.budget -= item.price;
    world.transferMarket.splice(itemIndex, 1);

    if (item.pos === "Head Coach") {
        club.coach = { name: item.name, rating: item.ovr };
    } else {
        club.squad.push({ name: item.name, pos: item.pos, age: item.age, ovr: item.ovr, wage: Math.round(item.price * 0.002) });
    }
    res.json({ success: true, world, club });
});

app.delete('/api/universes/:worldId', (req, res) => {
    const { worldId } = req.params;
    const { adminName } = req.body;
    let index = database.universes.findIndex(w => w.id === worldId);
    if (index === -1) return res.status(404).json({ error: "Universe not found" });
    if (database.universes[index].admin.toLowerCase() !== adminName.toLowerCase()) {
        return res.status(403).json({ error: "Unauthorized admin." });
    }
    database.universes.splice(index, 1);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

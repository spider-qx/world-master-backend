const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let database = {
    users: [],
    universes: [
        {
            id: "default_world",
            name: "Premier Elite Universe",
            admin: "Spider23qX",
            matchday: 1,
            matchIntervalHours: 24, // Admin-set duration between 1 to 24 hours
            simulationRunning: false, // Match simulation stays paused until admin starts it
            lastSimulationTime: null,
            laws: "1. Financial Fair Play active.\n2. Transfer caps enforced by Aya.",
            activeTournament: "World Master League Cup",
            newsletters: ["📰 [FA Gazette]: Welcome to the Premier Elite Universe."],
            transferMarket: [
                { id: 101, name: "Mateo Fernandez", pos: "RW", age: 21, ovr: 83, price: 16000000 },
                { id: 102, name: "Pep Lijnders", pos: "Head Coach", age: 43, ovr: 85, price: 5000000 }
            ],
            fixtures: [],
            clubs: {}
        }
    ]
};

// --- LEAGUE AI BACKGROUND TICK (Handles automated match intervals from 1 to 24 hours) ---
setInterval(() => {
    const now = Date.now();
    database.universes.forEach(world => {
        if (!world.simulationRunning || world.matchday > (world.fixtures.length || 0)) return;

        const intervalHours = world.matchIntervalHours || 24;
        const intervalMs = intervalHours * 60 * 60 * 1000;

        if (!world.lastSimulationTime) {
            world.lastSimulationTime = now;
        }

        if (now - world.lastSimulationTime >= intervalMs) {
            runMatchdaySimulation(world);
            world.lastSimulationTime = now;
        }
    });
}, 15000); // Check every 15 seconds

function runMatchdaySimulation(world) {
    let currentRoundObj = world.fixtures.find(f => f.matchday === world.matchday);
    if (!currentRoundObj) return;

    let roundSummary = `=== [LEAGUE AI] AUTOMATED MATCHDAY ${world.matchday} RESULTS ===\n`;

    currentRoundObj.matches.forEach(match => {
        if (match.played) return;

        let homeClub = world.clubs[match.home];
        let awayClub = world.clubs[match.away];
        if (!homeClub || !awayClub) return;

        let homePower = homeClub.squad.reduce((acc, p) => acc + p.ovr, 0) / (homeClub.squad.length || 1) + (homeClub.coach?.rating || 70);
        let awayPower = awayClub.squad.reduce((acc, p) => acc + p.ovr, 0) / (awayClub.squad.length || 1) + (awayClub.coach?.rating || 70);

        let homeGoals = Math.max(0, Math.floor((homePower / 40) + (Math.random() * 2.2) - 1));
        let awayGoals = Math.max(0, Math.floor((awayPower / 40) + (Math.random() * 2.2) - 1));

        homeClub.played++; awayClub.played++;
        homeClub.gf += homeGoals; homeClub.ga += awayGoals;
        awayClub.gf += awayGoals; awayClub.ga += homeGoals;

        if (homeGoals > awayGoals) {
            homeClub.won++; homeClub.points += 3; awayClub.lost++;
        } else if (homeGoals < awayGoals) {
            awayClub.won++; awayClub.points += 3; homeClub.lost++;
        } else {
            homeClub.drawn++; homeClub.points += 1; awayClub.drawn++; awayClub.points += 1;
        }

        match.played = true;
        match.score = `${homeGoals} - ${awayGoals}`;
        roundSummary += `⚽ ${homeClub.name} (${homeGoals}) - (${awayGoals}) ${awayClub.name}\n`;
    });

    world.newsletters.unshift(roundSummary);
    world.matchday++;
}

// --- AUTHENTICATION ---
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields." });

    let existing = database.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existing) return res.status(400).json({ error: "Username already taken." });

    database.users.push({ username, password });
    res.json({ success: true, username });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields." });

    let user = database.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (!user) return res.status(400).json({ error: "Invalid credentials." });

    res.json({ success: true, username: user.username });
});

// --- UNIVERSE MANAGEMENT ---
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
        matchday: 1,
        matchIntervalHours: 24, // Default to 24 hours
        simulationRunning: false, // Paused by default until admin starts it
        lastSimulationTime: null,
        laws: "1. FFP Active.\n2. Fair Bidding enforced by Aya.",
        activeTournament: "Inaugural Universe Cup",
        newsletters: [`📰 [FA Gazette]: Universe '${name}' created by ${admin}.`],
        transferMarket: [
            { id: Date.now() + 1, name: "Mikel Arteta Jr", pos: "Head Coach", age: 44, ovr: 88, price: 7000000 }
        ],
        fixtures: [],
        clubs: {}
    };

    database.universes.push(newWorld);
    res.json({ success: true, world: newWorld });
});

// --- ADMIN CONFIGURATION ENDPOINTS (Duration & Start/Pause) ---
app.post('/api/universes/:worldId/config', (req, res) => {
    const { worldId } = req.params;
    const { adminName, matchIntervalHours, simulationRunning } = req.body;
    
    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "Universe not found" });

    if (world.admin.toLowerCase() !== adminName.toLowerCase()) {
        return res.status(403).json({ error: "Only the verified world admin can modify simulation settings." });
    }

    if (matchIntervalHours !== undefined) {
        world.matchIntervalHours = Math.max(1, Math.min(24, Number(matchIntervalHours)));
    }
    if (simulationRunning !== undefined) {
        world.simulationRunning = Boolean(simulationRunning);
        if (world.simulationRunning && !world.lastSimulationTime) {
            world.lastSimulationTime = Date.now();
        }
    }

    res.json({ success: true, world });
});

// --- JOIN CLUB & FIXTURE GENERATOR ---
app.post('/api/universes/:worldId/join', (req, res) => {
    const { worldId } = req.params;
    const { username, clubName } = req.body;

    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "Universe not found" });

    let clubKey = clubName.toLowerCase().replace(/\s+/g, '_');

    if (!world.clubs[clubKey]) {
        world.clubs[clubKey] = {
            name: clubName,
            owner: username,
            budget: 35000000,
            stadiumCap: 40000,
            points: 0, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0,
            coach: { name: "Unassigned", rating: 0 },
            squad: [
                { name: "Starter Striker", pos: "ST", age: 24, ovr: 78, wage: 20000 }
            ]
        };
        generateFixtures(world);
    }

    res.json({ success: true, world, clubKey });
});

function generateFixtures(world) {
    let keys = Object.keys(world.clubs);
    world.fixtures = [];
    if (keys.length < 2) return;

    let list = [...keys];
    if (list.length % 2 !== 0) list.push("BYE");

    let totalRounds = list.length - 1;
    let half = list.length / 2;

    for (let round = 0; round < totalRounds; round++) {
        let matchdayFixtures = [];
        for (let i = 0; i < half; i++) {
            let home = list[i];
            let away = list[list.length - 1 - i];
            if (home !== "BYE" && away !== "BYE") {
                matchdayFixtures.push({ home, away, played: false, score: null });
            }
        }
        world.fixtures.push({ matchday: round + 1, matches: matchdayFixtures });
        list.splice(1, 0, list.pop());
    }
}

// --- TRANSFER MARKET ---
app.post('/api/universes/:worldId/transfer', (req, res) => {
    const { worldId } = req.params;
    const { clubKey, itemId } = req.body;

    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "Universe not found" });

    let club = world.clubs[clubKey];
    let itemIndex = world.transferMarket.findIndex(i => i.id === itemId);

    if (itemIndex === -1) return res.status(400).json({ error: "Aya: Player or Coach already signed by another club!" });

    let item = world.transferMarket[itemIndex];

    if (club.budget < item.price) {
        return res.status(400).json({ error: "Aya: Transfer denied. Insufficient club funds." });
    }

    club.budget -= item.price;
    world.transferMarket.splice(itemIndex, 1);

    if (item.pos === "Head Coach") {
        club.coach = { name: item.name, rating: item.ovr };
    } else {
        club.squad.push({ name: item.name, pos: item.pos, age: item.age, ovr: item.ovr, wage: Math.round(item.price * 0.002) });
    }

    res.json({ success: true, world, club });
});

// --- ADMIN MANAGEMENT & INJECTIONS ---
app.post('/api/universes/:worldId/admin', (req, res) => {
    const { worldId } = req.params;
    const { action, data } = req.body;

    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "Universe not found" });

    if (action === 'inject') {
        world.transferMarket.push({ id: Date.now(), ...data });
    } else if (action === 'tournament') {
        world.activeTournament = data.tournamentName;
        world.newsletters.unshift(`📰 [Tournament]: Admin launched '${data.tournamentName}'!`);
    } else if (action === 'newsletter') {
        world.newsletters.unshift(`📰 [Admin Dispatch]: ${data.text}`);
    }

    res.json({ success: true, world });
});

app.delete('/api/universes/:worldId', (req, res) => {
    const { worldId } = req.params;
    let index = database.universes.findIndex(w => w.id === worldId);
    if (index === -1) return res.status(404).json({ error: "Universe not found" });
    database.universes.splice(index, 1);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`World Master Backend Server running on port ${PORT}`));

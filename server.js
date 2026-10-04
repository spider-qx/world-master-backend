const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let database = {
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

// Get all universes
app.get('/api/universes', (req, res) => {
    res.json(database.universes);
});

// Create a new Universe
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

// Delete a Universe (Admin Only)
app.delete('/api/universes/:worldId', (req, res) => {
    const { worldId } = req.params;
    const { adminName } = req.body;

    let index = database.universes.findIndex(w => w.id === worldId);
    if (index === -1) return res.status(404).json({ error: "Universe not found" });

    if (database.universes[index].admin.toLowerCase() !== adminName.toLowerCase()) {
        return res.status(403).json({ error: "Only the designated admin can delete this world." });
    }

    database.universes.splice(index, 1);
    res.json({ success: true });
});

// Join or Resume Club Session (Persistent)
app.post('/api/universes/:worldId/join', (req, res) => {
    const { worldId } = req.params;
    const { managerName, clubName } = req.body;

    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "Universe not found" });

    let clubKey = clubName.toLowerCase().replace(/\s+/g, '_');

    // If club doesn't exist, create it. If it exists, it logs them right back in with their stats intact!
    if (!world.clubs[clubKey]) {
        world.clubs[clubKey] = {
            name: clubName,
            owner: managerName,
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

// Universal Automatic Matchday Simulation (Simulates matches for all active clubs)
app.post('/api/universes/:worldId/simulate', (req, res) => {
    const { worldId } = req.params;
    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "Universe not found" });

    let clubKeys = Object.keys(world.clubs);
    if (clubKeys.length < 2) {
        return res.status(400).json({ error: "Need at least 2 clubs in the universe to simulate matchday fixtures!" });
    }

    // Pair up clubs for this matchday
    let resultsSummary = `--- Matchday ${world.matchday} Results ---\n`;
    
    for (let i = 0; i < clubKeys.length; i += 2) {
        if (i + 1 < clubKeys.length) {
            let homeKey = clubKeys[i];
            let awayKey = clubKeys[i+1];
            let homeClub = world.clubs[homeKey];
            let awayClub = world.clubs[awayKey];

            // Calculate goals based on squad strength + coach rating
            let homeStrength = homeClub.squad.reduce((acc, p) => acc + p.ovr, 0) / (homeClub.squad.length || 1) + homeClub.coach.rating;
            let awayStrength = awayClub.squad.reduce((acc, p) => acc + p.ovr, 0) / (awayClub.squad.length || 1) + awayClub.coach.rating;

            let homeGoals = Math.floor(Math.random() * (homeStrength > awayStrength ? 3 : 2));
            let awayGoals = Math.floor(Math.random() * (awayStrength > homeStrength ? 3 : 2));

            // Update table stats
            homeClub.played++;
            awayClub.played++;
            homeClub.gf += homeGoals;
            homeClub.ga += awayGoals;
            awayClub.gf += awayGoals;
            awayClub.ga += homeGoals;

            if (homeGoals > awayGoals) {
                homeClub.won++; homeClub.points += 3;
                awayClub.lost++;
            } else if (homeGoals < awayGoals) {
                awayClub.won++; awayClub.points += 3;
                homeClub.lost++;
            } else {
                homeClub.drawn++; homeClub.points += 1;
                awayClub.drawn++; awayClub.points += 1;
            }

            resultsSummary += `${homeClub.name} ${homeGoals} - ${awayGoals} ${awayClub.name}\n`;
        }
    }

    world.matchesLog.unshift(resultsSummary);
    world.matchday++;

    res.json({ success: true, world });
});

// Transfer execution
app.post('/api/universes/:worldId/transfer', (req, res) => {
    const { worldId } = req.params;
    const { clubKey, itemId } = req.body;

    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "Universe not found" });

    let club = world.clubs[clubKey];
    let itemIndex = world.transferMarket.findIndex(i => i.id === itemId);

    if (itemIndex === -1) return res.status(400).json({ error: "Aya: Item already signed!" });
    let item = world.transferMarket[itemIndex];

    if (club.budget < item.price) return res.status(400).json({ error: "Aya: Insufficient funds." });

    club.budget -= item.price;
    world.transferMarket.splice(itemIndex, 1);

    if (item.pos === "Head Coach") {
        club.coach = { name: item.name, rating: item.ovr };
    } else {
        club.squad.push({ name: item.name, pos: item.pos, age: item.age, ovr: item.ovr, wage: Math.round(item.price * 0.002) });
    }

    res.json({ success: true, world, club });
});

// Admin Actions
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

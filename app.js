
let players = [];
let matchPlans = [];

const playerInput = document.getElementById('player-input');
const addPlayerBtn = document.getElementById('add-player-btn');
const playersList = document.getElementById('players-list');
const playerCountSpan = document.getElementById('player-count');
const clearAllBtn = document.getElementById('clear-all-btn');
const generateTeamsBtn = document.getElementById('generate-teams-btn');
const teamsContainer = document.getElementById('teams-container');

addPlayerBtn.addEventListener('click', addPlayer);
playerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addPlayer();
});
clearAllBtn.addEventListener('click', clearAllPlayers);
generateTeamsBtn.addEventListener('click', generateMatchPlans);
document.getElementById('formation-select').addEventListener('change', () => {
    if (matchPlans.length > 0) updateUI();
});

function addPlayer() {
    const inputValue = playerInput.value.trim();
    if (!inputValue) return;

    if (players.length >= 14) {
        alert("Maximum 14 players allowed for a single squad.");
        playerInput.value = '';
        return;
    }

    const newNames = inputValue.split(',')
        .map(n => n.trim())
        .filter(n => n && !players.includes(n));

    if (newNames.length === 0) {
        alert(inputValue.includes(',') ? 'All these players are already in the squad!' : 'Player already exists!');
        return;
    }

    const spaceLeft = 14 - players.length;
    const toAdd = newNames.slice(0, spaceLeft);
    if (newNames.length > spaceLeft) {
        alert(`Only space for ${spaceLeft} more players. Some were ignored.`);
    }

    players.push(...toAdd);
    playerInput.value = '';
    playerInput.focus();

    updateUI();
}

function removePlayer(name) {
    players = players.filter(p => p !== name);
    matchPlans = [];
    updateUI();
}

function clearAllPlayers() {
    if (players.length > 0 && confirm('Are you sure you want to clear the entire squad?')) {
        players = [];
        matchPlans = [];
        updateUI();
    }
}

function generateMatchPlans() {
    if (players.length < 7) {
        alert('You need at least 7 players to field a 7-a-side team!');
        return;
    }

    const numGamesInput = document.querySelector('input[name="num-games"]:checked');
    const numGames = numGamesInput ? parseInt(numGamesInput.value) : 2;

    matchPlans = [];

    let playerStats = players.map(p => ({ name: p, mins: 0 }));

    for (let i = playerStats.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playerStats[i], playerStats[j]] = [playerStats[j], playerStats[i]];
    }

    for (let g = 0; g < numGames; g++) {
        let sortedPlayers = [...playerStats].sort((a, b) => (a.mins + Math.random() * 0.1) - (b.mins + Math.random() * 0.1));

        let starters = sortedPlayers.slice(0, 7);
        let subs = sortedPlayers.slice(7);

        starters.forEach(p => p.mins += 10);

        let swaps = [];
        if (subs.length > 0) {
            let sortedStarters = [...starters].sort((a, b) => (b.mins + Math.random() * 0.1) - (a.mins + Math.random() * 0.1));

            for (let i = 0; i < subs.length; i++) {
                let subIn = subs[i];
                let subOut = sortedStarters[i];

                swaps.push({ in: subIn.name, out: subOut.name });

                subIn.mins += 10;
            }

            for (let i = subs.length; i < starters.length; i++) {
                sortedStarters[i].mins += 10;
            }
        } else {
            starters.forEach(p => p.mins += 10);
        }

        matchPlans.push({
            id: g + 1,
            title: `Game ${g + 1}`,
            starters: starters.map(p => p.name),
            subs: subs.map(p => p.name),
            swaps: swaps
        });
    }

    updateUI();
}

function renderMatchCard(matchPlan, delay) {
    const template = document.getElementById('match-template').content.cloneNode(true);
    const card = template.querySelector('.match-card');

    card.style.animationDelay = `${delay}s`;

    card.querySelector('.team-name-input').value = matchPlan.title;
    card.querySelector('.sub-count').textContent = matchPlan.subs.length;

    const pitchPlayers = [...matchPlan.starters];
    const getNext = () => pitchPlayers.length > 0 ? pitchPlayers.shift() : 'Empty';

    const formationInput = document.getElementById('formation-select').value;
    const [defCount, midCount, fwdCount] = formationInput.split('-').map(Number);

    const gk = [getNext()];
    const def = Array.from({ length: defCount }, getNext);
    const mid = Array.from({ length: midCount }, getNext);
    const fwd = Array.from({ length: fwdCount }, getNext);

    const populateRow = (rowClass, arr) => {
        const row = card.querySelector(`.${rowClass}`);
        arr.forEach(p => {
            if (p !== 'Empty' && p !== undefined) {
                const token = document.createElement('div');
                token.className = 'player-token';
                token.textContent = p;
                token.title = p;
                row.appendChild(token);
            }
        });
    };

    populateRow('row-gk', gk);
    populateRow('row-def', def);
    populateRow('row-mid', mid);
    populateRow('row-fwd', fwd);

    const subsList = card.querySelector('.subs-list');
    if (matchPlan.subs.length > 0) {
        matchPlan.subs.forEach(s => {
            const li = document.createElement('li');
            li.className = 'sub-token';
            li.textContent = s;
            subsList.appendChild(li);
        });
    } else {
        subsList.innerHTML = '<li class="sub-token" style="opacity:0.5;">None</li>';
    }

    const swapsSection = card.querySelector('.swaps-section');
    const swapsList = card.querySelector('.swaps-list');

    if (matchPlan.swaps.length > 0) {
        matchPlan.swaps.forEach(swap => {
            const li = document.createElement('li');
            li.className = 'swap-item';

            const inSpan = document.createElement('span');
            inSpan.className = 'swap-in';
            inSpan.textContent = `▲ ${swap.in}`;

            const arrowSpan = document.createElement('span');
            arrowSpan.className = 'swap-arrow';
            arrowSpan.innerHTML = '⇄';

            const outSpan = document.createElement('span');
            outSpan.className = 'swap-out';
            outSpan.textContent = `${swap.out} ▼`;

            li.appendChild(inSpan);
            li.appendChild(arrowSpan);
            li.appendChild(outSpan);
            swapsList.appendChild(li);
        });
    } else {
        swapsSection.style.display = 'none';
    }

    const downloadBtn = card.querySelector('.download-btn');
    downloadBtn.addEventListener('click', async () => {
        try {
            downloadBtn.style.display = 'none'; // Hide button for clean screenshot
            
            const canvas = await html2canvas(card, {
                backgroundColor: '#1f2937', // Match --card-bg visually
                scale: 2 // High resolution output
            });
            
            downloadBtn.style.display = 'flex'; // Show button again
            
            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = image;
            
            const gameName = card.querySelector('.team-name-input').value.replace(/[^a-zA-Z0-9_-]/g, '_');
            link.download = `${gameName || 'Match_Plan'}.png`;
            link.click();
        } catch (error) {
            console.error("Failed to export image:", error);
            downloadBtn.style.display = 'flex';
            alert("Sorry, an error occurred while downloading the image.");
        }
    });

    teamsContainer.appendChild(card);
}

function updateUI() {
    playersList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.className = 'player-item';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = player;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = `Remove ${player}`;
        removeBtn.onclick = () => removePlayer(player);

        li.appendChild(nameSpan);
        li.appendChild(removeBtn);
        playersList.appendChild(li);
    });

    playerCountSpan.textContent = players.length;
    generateTeamsBtn.disabled = players.length < 7;

    const statsBox = document.querySelector('.stats-box p');
    if (players.length >= 7 && players.length <= 14) {
        statsBox.textContent = `Squad looks good! ${players.length} players ready.`;
        statsBox.style.color = '#10b981';
    } else if (players.length < 7) {
        statsBox.textContent = `Need at least ${7 - players.length} more players to start.`;
        statsBox.style.color = 'var(--text-secondary)';
    }

    teamsContainer.innerHTML = '';

    if (matchPlans.length === 0) {
        teamsContainer.className = 'teams-section empty-state';
        teamsContainer.innerHTML = `
            <div class="empty-message">
                <div class="icon-placeholder">⏱️</div>
                <h3>No plans generated yet</h3>
                <p>Add 7 to 14 players, select the number of games, and click Generate.</p>
            </div>
        `;
    } else {
        teamsContainer.className = 'teams-section';
        matchPlans.forEach((plan, i) => {
            renderMatchCard(plan, i * 0.15);
        });
    }
}

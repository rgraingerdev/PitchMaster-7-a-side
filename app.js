
let players = [];
let matchPlans = [];

const loadState = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedData = urlParams.get('data');
    if (sharedData) {
        try {
            const decoded = JSON.parse(decodeURIComponent(atob(sharedData)));
            if (decoded.players) players = decoded.players;
            if (decoded.plans) matchPlans = decoded.plans;
            saveState(); // Saves the completely shared team to local browser memory!
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        } catch (e) {
            console.error('Failed to load shared data', e);
        }
    }

    const savedPlayers = localStorage.getItem('pitchMasterPlayers');
    const savedPlans = localStorage.getItem('pitchMasterPlans');
    if (savedPlayers) players = JSON.parse(savedPlayers);
    if (savedPlans) matchPlans = JSON.parse(savedPlans);
};
const saveState = () => {
    localStorage.setItem('pitchMasterPlayers', JSON.stringify(players));
    localStorage.setItem('pitchMasterPlans', JSON.stringify(matchPlans));
};

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

const shareBtn = document.getElementById('share-btn');
if (shareBtn) {
    shareBtn.addEventListener('click', () => {
        const state = { players, plans: matchPlans };
        const encoded = btoa(encodeURIComponent(JSON.stringify(state)));
        const url = window.location.origin + window.location.pathname + '?data=' + encoded;
        navigator.clipboard.writeText(url).then(() => {
            const originalText = shareBtn.innerHTML;
            shareBtn.innerHTML = 'Copied! ✅';
            setTimeout(() => shareBtn.innerHTML = originalText, 2000);
        }).catch(err => {
            prompt('Copy this link to share:', url);
        });
    });
}

function addPlayer() {
    const inputValue = playerInput.value.trim();
    if (!inputValue) return;

    const posVal = document.getElementById('player-pos').value;
    const newNames = inputValue.split(',')
        .map(n => n.trim())
        .filter(n => n && !players.some(p => p.name.toLowerCase() === n.toLowerCase()));

    if (newNames.length === 0) {
        alert(inputValue.includes(',') ? 'All these players are already in the squad!' : 'Player already exists!');
        return;
    }

    players.push(...newNames.map(n => ({ name: n, pos: posVal })));
    playerInput.value = '';
    playerInput.focus();

    updateUI();
}

function removePlayer(name) {
    players = players.filter(p => p.name !== name);
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
    const availablePlayers = players.filter(p => p.isAvailable !== false);

    if (availablePlayers.length < 7) {
        alert('You need at least 7 available players to field a 7-a-side team!');
        return;
    }
    if (availablePlayers.length > 14) {
        alert('Maximum 14 players allowed for auto-generation. Please turn off some toggles first.');
        return;
    }

    const numGamesInput = document.querySelector('input[name="num-games"]:checked');
    const numGames = numGamesInput ? parseInt(numGamesInput.value) : 2;

    // Ignore empty locked plans so the generator natively replaces blank templates with fully spun teams
    const lockedPlans = matchPlans.filter(p => p.isLocked && p.starters.length > 0);
    matchPlans = [...lockedPlans];

    let playerStats = availablePlayers.map(p => ({ name: p.name, pos: p.pos, mins: 0 }));

    // Apply minutes manually accrued from locked plans
    lockedPlans.forEach(plan => {
        plan.starters.forEach(sp => {
            const stat = playerStats.find(p => p.name === sp.name);
            let playedMins = 20;
            if (plan.swaps && plan.swaps.some(s => s.out === sp.name)) playedMins -= 10;
            if (stat) stat.mins += playedMins;
        });
        plan.subs.forEach(sp => {
            const stat = playerStats.find(p => p.name === sp.name);
            let playedMins = 0;
            if (plan.swaps && plan.swaps.some(s => s.in === sp.name)) playedMins += 10;
            if (stat) stat.mins += playedMins;
        });
    });

    for (let i = playerStats.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playerStats[i], playerStats[j]] = [playerStats[j], playerStats[i]];
    }

    const gamesToGenerate = numGames - lockedPlans.length;

    for (let g = 0; g < gamesToGenerate; g++) {
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
            id: matchPlans.length + 1,
            title: `Game ${matchPlans.length + 1}`,
            isLocked: false,
            starters: starters.map(p => ({ name: p.name, pos: p.pos })),
            subs: subs.map(p => ({ name: p.name, pos: p.pos })),
            swaps: swaps
        });
    }

    updateUI();
}

function renderMatchCard(matchPlan, delay) {
    const swapPlayersInPlan = (nameA, nameB) => {
        let indexA = matchPlan.starters.findIndex(x => x.name === nameA);
        let listA = matchPlan.starters;
        if (indexA === -1) { indexA = matchPlan.subs.findIndex(x => x.name === nameA); listA = matchPlan.subs; }
        
        let indexB = matchPlan.starters.findIndex(x => x.name === nameB);
        let listB = matchPlan.starters;
        if (indexB === -1) { indexB = matchPlan.subs.findIndex(x => x.name === nameB); listB = matchPlan.subs; }
        
        if (indexA !== -1 && indexB !== -1) {
            matchPlan.isLocked = true;
            const tempPos = listA[indexA].pos;
            listA[indexA].pos = listB[indexB].pos;
            listB[indexB].pos = tempPos;
            
            const temp = listA[indexA];
            listA[indexA] = listB[indexB];
            listB[indexB] = temp;
            
            saveState();
            setTimeout(updateUI, 10);
        } else if (indexA === -1 && indexB !== -1) {
            // External Drag from Master Pool onto Existing Player
            const playerObj = players.find(p => p.name === nameA);
            if (playerObj) {
                matchPlan.isLocked = true;
                listB[indexB] = { ...playerObj, pos: listB[indexB].pos };
                saveState();
                setTimeout(updateUI, 10);
            }
        }
    };

    const template = document.getElementById('match-template').content.cloneNode(true);
    const card = template.querySelector('.match-card');

    card.style.animationDelay = `${delay}s`;

    card.querySelector('.team-name-input').value = matchPlan.title;
    card.querySelector('.team-name-input').addEventListener('change', (e) => {
        matchPlan.title = e.target.value;
        saveState();
    });

    const lockBtn = document.createElement('button');
    lockBtn.className = 'lock-btn';
    lockBtn.title = matchPlan.isLocked ? 'Unlock Match (will be regenerated)' : 'Lock Match (prevents regeneration)';
    lockBtn.style.background = 'transparent';
    lockBtn.style.border = 'none';
    lockBtn.style.cursor = 'pointer';
    lockBtn.style.fontSize = '14px';
    lockBtn.style.opacity = matchPlan.isLocked ? '1' : '0.4';
    lockBtn.style.filter = matchPlan.isLocked ? 'grayscale(0)' : 'grayscale(1)';
    lockBtn.innerText = matchPlan.isLocked ? '🔒' : '🔓';
    lockBtn.onclick = () => {
        matchPlan.isLocked = !matchPlan.isLocked;
        saveState();
        updateUI();
    };
    card.querySelector('.header-actions').prepend(lockBtn);
    
    card.querySelector('.sub-count').textContent = matchPlan.subs.length;

    const formationInput = document.getElementById('formation-select').value;
    const [defCount, midCount, fwdCount] = formationInput.split('-').map(Number);

    let slots = { 'GK': 1, 'DEF': defCount, 'MID': midCount, 'FWD': fwdCount };
    let pitchAssignment = { 'GK': [], 'DEF': [], 'MID': [], 'FWD': [] };
    let unassigned = [];

    matchPlan.starters.forEach(p => {
        if (p.pos !== 'ANY' && slots[p.pos] > 0) {
            pitchAssignment[p.pos].push(p.name);
            slots[p.pos]--;
        } else {
            unassigned.push(p.name);
        }
    });

    // Removed Math.random() shuffle so manual Drag & Drop swaps are completely stable and deterministic
    const fillRow = (posKey) => {
        while (slots[posKey] > 0 && unassigned.length > 0) {
            pitchAssignment[posKey].push(unassigned.shift());
            slots[posKey]--;
        }
        while (slots[posKey] > 0) {
            pitchAssignment[posKey].push('Empty');
            slots[posKey]--;
        }
    };
    fillRow('GK');
    fillRow('DEF');
    fillRow('MID');
    fillRow('FWD');

    const gk = pitchAssignment['GK'];
    const def = pitchAssignment['DEF'];
    const mid = pitchAssignment['MID'];
    const fwd = pitchAssignment['FWD'];

    const populateRow = (rowClass, arr) => {
        const row = card.querySelector(`.${rowClass}`);
        arr.forEach((p, idx) => {
            const token = document.createElement('div');
            token.className = 'player-token';
            token.textContent = p;
            
            // Allow dropping onto any slot, even Empty ones!
            token.addEventListener('dragover', (e) => { e.preventDefault(); token.classList.add('drag-over'); });
            token.addEventListener('dragleave', () => token.classList.remove('drag-over'));
            token.addEventListener('drop', (e) => {
                e.preventDefault();
                token.classList.remove('drag-over');
                const draggedName = e.dataTransfer.getData('text/plain');
                if (draggedName && draggedName !== p) {
                    if (p === 'Empty') {
                        const playerObj = players.find(x => x.name === draggedName);
                        if (playerObj) {
                            matchPlan.isLocked = true;
                            const posKey = rowClass.replace('row-', '').toUpperCase();
                            // Check if moving from within pitch
                            let existIndex = matchPlan.starters.findIndex(x => x.name === draggedName);
                            if (existIndex !== -1) {
                                matchPlan.starters[existIndex].pos = posKey;
                            } else {
                                let existSub = matchPlan.subs.findIndex(x => x.name === draggedName);
                                if (existSub !== -1) matchPlan.subs.splice(existSub, 1);
                                matchPlan.starters.push({ ...playerObj, pos: posKey });
                            }
                            saveState();
                            setTimeout(updateUI, 10);
                        }
                    } else {
                        swapPlayersInPlan(draggedName, p);
                    }
                }
            });

            if (p !== 'Empty' && p !== undefined) {
                token.title = p;
                token.draggable = true;
                token.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', p);
                    setTimeout(() => token.classList.add('dragging'), 0);
                });
                token.addEventListener('dragend', () => token.classList.remove('dragging'));
            } else {
                token.classList.add('empty-slot');
                token.style.border = '1px dashed rgba(255,255,255,0.3)';
                token.style.background = 'rgba(0,0,0,0.2)';
                token.style.color = 'transparent';
                token.style.cursor = 'default';
            }
            
            row.appendChild(token);
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
            li.textContent = s.name;
            li.draggable = true;
            
            li.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', s.name);
                setTimeout(() => li.classList.add('dragging'), 0);
            });
            li.addEventListener('dragend', () => li.classList.remove('dragging'));
            li.addEventListener('dragover', (e) => { e.preventDefault(); li.classList.add('drag-over'); });
            li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
            li.addEventListener('drop', (e) => {
                e.preventDefault();
                li.classList.remove('drag-over');
                const draggedName = e.dataTransfer.getData('text/plain');
                if (draggedName && draggedName !== s.name) swapPlayersInPlan(draggedName, s.name);
            });
            
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
            
            canvas.toBlob((blob) => {
                if (!blob) {
                    console.error("Canvas toBlob failed");
                    downloadBtn.style.display = 'flex';
                    alert("Sorry, an error occurred preparing the image download.");
                    return;
                }
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                
                const gameName = card.querySelector('.team-name-input').value.replace(/[^a-zA-Z0-9_-]/g, '_');
                link.download = `${gameName || 'Match_Plan'}.png`;
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            }, 'image/png');
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
        const token = document.createElement('div');
        token.className = 'player-token';
        token.style.position = 'relative';
        token.draggable = true;
        
        const isAvail = player.isAvailable !== false;
        token.style.opacity = isAvail ? '1' : '0.4';
        
        // Let clicking the token completely toggle attendance
        token.onclick = () => {
            player.isAvailable = !isAvail;
            saveState();
            updateUI();
        };

        token.innerHTML = `<span style="font-weight:700; pointer-events: none;">${player.name}</span> <span style="font-size:10px; opacity:0.8; pointer-events: none; margin-left: 6px;">${player.pos}</span>`;

        const removeBtn = document.createElement('span');
        removeBtn.innerHTML = '&times;';
        removeBtn.style.position = 'absolute';
        removeBtn.style.top = '-6px';
        removeBtn.style.right = '-6px';
        removeBtn.style.background = 'var(--accent-red)';
        removeBtn.style.color = '#fff';
        removeBtn.style.borderRadius = '50%';
        removeBtn.style.width = '18px';
        removeBtn.style.height = '18px';
        removeBtn.style.fontSize = '12px';
        removeBtn.style.lineHeight = '18px';
        removeBtn.style.textAlign = 'center';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5)';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            removePlayer(player.name);
        };
        token.appendChild(removeBtn);

        token.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', player.name);
            setTimeout(() => token.classList.add('dragging'), 0);
        });
        token.addEventListener('dragend', () => token.classList.remove('dragging'));

        playersList.appendChild(token);
    });

    const availableCount = players.filter(p => p.isAvailable !== false).length;

    const statsBox = document.getElementById('player-pool-stats');
    if (statsBox) {
        if (availableCount > 0) {
            statsBox.textContent = `${availableCount} players ready.`;
            statsBox.style.color = '#10b981';
        } else {
            statsBox.textContent = `Squad is empty / no active players.`;
            statsBox.style.color = 'var(--text-secondary)';
        }
    }

    playerCountSpan.textContent = `${availableCount} avail / ${players.length} total`;
    generateTeamsBtn.disabled = availableCount < 7;

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

        const summaryCard = document.createElement('div');
        summaryCard.className = 'team-card';
        summaryCard.style.animationDelay = `${matchPlans.length * 0.15}s`;
        
        let tracking = {};
        matchPlans.forEach(plan => {
            plan.starters.forEach(p => {
                if (!tracking[p.name]) tracking[p.name] = 0;
                let mins = 20;
                if (plan.swaps && plan.swaps.some(s => s.out === p.name)) mins -= 10;
                tracking[p.name] += mins;
            });
            plan.subs.forEach(p => {
                if (!tracking[p.name]) tracking[p.name] = 0;
                let mins = 0;
                if (plan.swaps && plan.swaps.some(s => s.in === p.name)) mins += 10;
                tracking[p.name] += mins;
            });
        });

        const sortedPlayers = Object.entries(tracking).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        
        let html = `
            <div class="team-header" style="justify-content: center; background: rgba(255,255,255,0.05); padding: 16px;">
                <h3 style="margin:0; font-size:18px; color:var(--text-primary);">📊 Match Day Minutes Tally</h3>
            </div>
            <div style="padding: 20px;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; color: var(--text-primary); font-size: 14px;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-secondary);">
                            <th style="padding: 8px 4px; font-weight: 600;">Player Name</th>
                            <th style="padding: 8px 4px; text-align: right; font-weight: 600;">Total Minutes</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        sortedPlayers.forEach(([name, mins]) => {
            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <td style="padding: 12px 4px; font-weight: 500;">${name}</td>
                    <td style="padding: 12px 4px; text-align: right; font-weight: 700; color: ${mins > 0 ? 'var(--accent-green)' : 'var(--text-secondary)'};">${mins} mins</td>
                </tr>
            `;
        });
        
        html += `</tbody></table></div>`;
        summaryCard.innerHTML = html;
        teamsContainer.appendChild(summaryCard);
    }
    saveState();
}

const addEmptyBtn = document.getElementById('add-empty-btn');
if (addEmptyBtn) {
    addEmptyBtn.addEventListener('click', () => {
        matchPlans.push({
            id: matchPlans.length + 1,
            title: `Custom Game ${matchPlans.length + 1}`,
            isLocked: true,
            starters: [],
            subs: [],
            swaps: []
        });
        saveState();
        updateUI();
    });
}

// Init
loadState();
updateUI();

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

;(async () => {
  try {
    const SUPABASE_URL = 'https://xhhmxabftbyxrirvvihn.supabase.co'
    const SUPABASE_KEY = 'sb_publishable_NZHoIxqqpSvVBP8MrLHCYA_gmg1AbN-'
    const T_PLAYERS = 'uNMexs7BYTXQ2_bluff_poker_players'
    const T_GAMES = 'uNMexs7BYTXQ2_bluff_poker_games'
    const T_HANDS = 'uNMexs7BYTXQ2_bluff_poker_hands'
    const T_ACTIONS = 'uNMexs7BYTXQ2_bluff_poker_actions'
    const T_BLUFFS = 'uNMexs7BYTXQ2_bluff_poker_bluffs'
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    /* ---------- DOM ---------- */
    const $ = id => document.getElementById(id)
    const views = { join: $('joinView'), lobby: $('lobbyView'), game: $('gameView') }
    const joinForm = $('joinForm')
    const nameInput = $('nameInput')
    const joinStatus = $('joinStatus')
    const playersGrid = $('playersGrid')
    const leaderboardList = $('leaderboardList')
    const startGameBtn = $('startGameBtn')
    const leaveLobbyBtn = $('leaveLobbyBtn')
    const phaseBadge = $('phaseBadge')
    const potDisplay = $('potDisplay')
    const potCenter = $('potCenter')
    const potChips = $('potChips')
    const myChipsDisplay = $('myChipsDisplay')
    const opponentsRow = $('opponentsRow')
    const myCards = $('myCards')
    const handLabel = $('handLabel')
    const gameMessage = $('gameMessage')
    const betControls = $('betControls')
    const bluffControls = $('bluffControls')
    const callBluffControls = $('callBluffControls')
    const bluffClaims = $('bluffClaims')
    const actionLog = $('actionLog')
    const resultsOverlay = $('resultsOverlay')
    const resultsTitle = $('resultsTitle')
    const resultsBody = $('resultsBody')
    const nextRoundBtn = $('nextRoundBtn')
    const backToLobbyBtn = $('backToLobbyBtn')

    /* ---------- STATE ---------- */
    let me = null // player row
    let sessionId = crypto.randomUUID()
    let currentGame = null
    let myHand = null
    let allHands = []
    let allPlayers = []
    let gamePlayers = []
    let gameActions = []
    let gameBluffs = []
    let subscriptions = []

    /* ---------- UTILS ---------- */
    function showView(name) {
      Object.entries(views).forEach(([k, el]) => el.classList.toggle('active', k === name))
    }

    function escapeHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    }

    /* ---------- CARD & HAND LOGIC ---------- */
    const SUITS = ['♥','♦','♣','♠']
    const VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
    const VAL_MAP = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 }

    function newDeck() {
      const d = []
      for (const s of SUITS) for (const v of VALUES) d.push({ value: v, suit: s })
      return d
    }

    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    }

    function isRed(suit) { return suit === '♥' || suit === '♦' }

    function evaluateHand(cards) {
      if (!cards || cards.length < 3) return { rank: 0, name: 'Unknown' }
      const vals = cards.map(c => VAL_MAP[c.value]).sort((a, b) => b - a)
      const suits = cards.map(c => c.suit)

      const isFlush = suits[0] === suits[1] && suits[1] === suits[2]
      const sorted = [...vals].sort((a, b) => a - b)
      const isStraight = (sorted[2] - sorted[1] === 1 && sorted[1] - sorted[0] === 1) ||
        (sorted[0] === 2 && sorted[1] === 3 && sorted[2] === 14) // A-2-3

      const counts = {}
      vals.forEach(v => { counts[v] = (counts[v] || 0) + 1 })
      const freqs = Object.values(counts).sort((a, b) => b - a)

      if (isFlush) return { rank: 6, name: 'Flush' }
      if (isStraight) return { rank: 5, name: 'Straight' }
      if (freqs[0] === 3) return { rank: 4, name: 'Three of a Kind' }
      // With 3 cards, two pair isn't possible, but we handle it just in case
      if (freqs[0] === 2) return { rank: 2, name: 'Pair' }
      return { rank: 1, name: 'High Card' }
    }

    const RANK_NAMES = { 1:'High Card', 2:'Pair', 3:'Two Pair', 4:'Three of a Kind', 5:'Straight', 6:'Flush' }

    function cardHtml(card, small = false) {
      if (small) {
        const red = isRed(card.suit)
        return `<div class="mini-card revealed ${red ? 'red' : ''}">${card.value}${card.suit}</div>`
      }
      const red = isRed(card.suit)
      return `
        <div class="card ${red ? 'red' : 'black'}" style="animation-delay:${Math.random() * 0.2}s">
          <span class="card-value">${card.value}</span>
          <span class="card-suit">${card.suit}</span>
        </div>
      `
    }

    function chipVisuals(amount) {
      let html = ''
      const denominations = [100, 50, 25, 10]
      let remaining = amount
      for (const d of denominations) {
        while (remaining >= d && html.split('chip-visual').length <= 12) {
          html += `<div class="chip-visual chip-${d}">${d}</div>`
          remaining -= d
        }
      }
      return html
    }

    /* ---------- JOIN ---------- */
    joinForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      try {
        const name = nameInput.value.trim()
        if (!name || name.length < 2) {
          joinStatus.textContent = 'Name must be at least 2 characters.'
          return
        }
        joinStatus.textContent = 'Joining...'

        // Check if name taken by online player
        const { data: existing } = await supabase
          .from(T_PLAYERS)
          .select('id, session_id, is_online')
          .eq('display_name', name)
          .eq('is_online', true)
          .limit(1)

        if (existing && existing.length > 0) {
          // Reclaim if same browser or reject
          joinStatus.textContent = 'That name is already taken. Try another.'
          return
        }

        // Upsert player
        const { data: player, error } = await supabase
          .from(T_PLAYERS)
          .insert({
            display_name: name,
            session_id: sessionId,
            chips: 500,
            is_online: true,
            wins: 0,
            losses: 0,
            total_earnings: 0,
            current_game_id: null,
            last_seen: new Date().toISOString()
          })
          .select()
          .single()

        if (error) throw error
        me = player
        joinStatus.textContent = ''
        showView('lobby')
        startLobby()
      } catch (err) {
        console.error('Join error:', err.message, err.stack)
        joinStatus.textContent = err.message || 'Failed to join.'
      }
    })

    /* ---------- LOBBY ---------- */
    async function startLobby() {
      await loadLobbyPlayers()
      await loadLeaderboard()

      // Real-time player changes
      const playerSub = supabase.channel('lobby-players')
        .on('postgres_changes', { event: '*', schema: 'public', table: T_PLAYERS }, () => {
          loadLobbyPlayers()
          loadLeaderboard()
        })
        .subscribe()
      subscriptions.push(playerSub)

      // Real-time game creation
      const gameSub = supabase.channel('lobby-games')
        .on('postgres_changes', { event: '*', schema: 'public', table: T_GAMES }, (payload) => {
          if (payload.new && payload.new.status === 'active' && me.current_game_id === null) {
            // Check if I'm in the turn order
            checkIfInGame(payload.new)
          }
        })
        .subscribe()
      subscriptions.push(gameSub)
    }

    async function loadLobbyPlayers() {
      try {
        const { data } = await supabase
          .from(T_PLAYERS)
          .select('*')
          .eq('is_online', true)
          .order('last_seen', { ascending: false })

        allPlayers = data || []
        renderLobbyPlayers()
        startGameBtn.disabled = allPlayers.length < 2
      } catch (err) {
        console.error('Load players error:', err.message)
      }
    }

    function renderLobbyPlayers() {
      playersGrid.innerHTML = allPlayers.map(p => `
        <div class="player-card">
          <div class="player-avatar">${escapeHtml(p.display_name.charAt(0).toUpperCase())}</div>
          <div class="player-name">${escapeHtml(p.display_name)}${p.id === me.id ? ' (you)' : ''}</div>
          <div class="player-chips">🪙 ${p.chips} chips</div>
        </div>
      `).join('')
    }

    async function loadLeaderboard() {
      try {
        const { data } = await supabase
          .from(T_PLAYERS)
          .select('display_name, chips, wins, losses')
          .order('chips', { ascending: false })
          .limit(10)

        leaderboardList.innerHTML = (data || []).map((p, i) => `
          <div class="lb-row">
            <div class="lb-rank ${i === 0 ? 'gold' : ''}">${i + 1}</div>
            <div class="lb-name">${escapeHtml(p.display_name)}</div>
            <div class="lb-chips">🪙 ${p.chips}</div>
            <div class="lb-record">${p.wins}W / ${p.losses}L</div>
          </div>
        `).join('')
      } catch (err) {
        console.error('Leaderboard error:', err.message)
      }
    }

    /* ---------- START GAME ---------- */
    startGameBtn.addEventListener('click', async () => {
      try {
        startGameBtn.disabled = true
        const gameId = crypto.randomUUID()

        // Get online players
        const { data: online } = await supabase
          .from(T_PLAYERS)
          .select('id, display_name, chips')
          .eq('is_online', true)

        if (!online || online.length < 2) {
          startGameBtn.disabled = false
          return
        }

        const playerIds = online.map(p => p.id)
        const turnOrder = shuffle([...playerIds])

        // Create game
        const { error: gameErr } = await supabase.from(T_GAMES).insert({
          game_id: gameId,
          status: 'active',
          phase: 'betting',
          pot: 0,
          current_bet: 0,
          current_turn_player_id: turnOrder[0],
          turn_order: turnOrder,
          turn_index: 0,
          round_number: 1,
          created_by: me.id
        })
        if (gameErr) throw gameErr

        // Deal cards
        const deck = shuffle(newDeck())
        let cardIdx = 0
        for (const pid of playerIds) {
          const hand = [deck[cardIdx++], deck[cardIdx++], deck[cardIdx++]]
          const eval_ = evaluateHand(hand)
          await supabase.from(T_HANDS).insert({
            game_id: gameId,
            player_id: pid,
            cards: hand,
            hand_rank: eval_.rank,
            hand_name: eval_.name,
            has_folded: false,
            bet_amount: 0,
            has_acted: false
          })
        }

        // Update all players' current_game_id
        for (const pid of playerIds) {
          await supabase.from(T_PLAYERS).update({ current_game_id: gameId }).eq('id', pid)
        }

        me.current_game_id = gameId
        enterGame(gameId)
      } catch (err) {
        console.error('Start game error:', err.message, err.stack)
        startGameBtn.disabled = false
      }
    })

    async function checkIfInGame(game) {
      try {
        const turnOrder = game.turn_order
        if (turnOrder && turnOrder.includes(me.id)) {
          // Refresh my data
          const { data } = await supabase.from(T_PLAYERS).select('*').eq('id', me.id).single()
          if (data) me = data
          if (me.current_game_id) {
            enterGame(me.current_game_id)
          }
        }
      } catch (err) {
        console.error('Check game error:', err.message)
      }
    }

    /* ---------- LEAVE LOBBY ---------- */
    leaveLobbyBtn.addEventListener('click', async () => {
      try {
        await supabase.from(T_PLAYERS).update({ is_online: false }).eq('id', me.id)
        cleanupSubscriptions()
        me = null
        showView('join')
      } catch (err) {
        console.error('Leave error:', err.message)
      }
    })

    /* ---------- ENTER GAME ---------- */
    async function enterGame(gameId) {
      cleanupSubscriptions()
      showView('game')
      resultsOverlay.hidden = true
      actionLog.innerHTML = ''

      await refreshGameState(gameId)

      // Subscribe to game changes
      const gSub = supabase.channel('game-' + gameId)
        .on('postgres_changes', { event: '*', schema: 'public', table: T_GAMES, filter: `game_id=eq.${gameId}` }, () => {
          refreshGameState(gameId)
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: T_HANDS, filter: `game_id=eq.${gameId}` }, () => {
          refreshGameState(gameId)
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: T_ACTIONS, filter: `game_id=eq.${gameId}` }, (payload) => {
          addLogEntry(payload.new)
          refreshGameState(gameId)
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: T_BLUFFS, filter: `game_id=eq.${gameId}` }, () => {
          refreshGameState(gameId)
        })
        .subscribe()
      subscriptions.push(gSub)
    }

    async function refreshGameState(gameId) {
      try {
        // Load game
        const { data: games } = await supabase
          .from(T_GAMES).select('*').eq('game_id', gameId).limit(1)
        if (!games || games.length === 0) return
        currentGame = games[0]

        // Load hands
        const { data: hands } = await supabase
          .from(T_HANDS).select('*').eq('game_id', gameId)
        allHands = hands || []
        myHand = allHands.find(h => h.player_id === me.id)

        // Load players in game
        const playerIds = currentGame.turn_order || []
        if (playerIds.length > 0) {
          const { data: players } = await supabase
            .from(T_PLAYERS).select('*').in('id', playerIds)
          gamePlayers = players || []
        }

        // Load bluffs
        const { data: bluffs } = await supabase
          .from(T_BLUFFS).select('*').eq('game_id', gameId)
        gameBluffs = bluffs || []

        // Refresh my chips
        const meData = gamePlayers.find(p => p.id === me.id)
        if (meData) {
          me.chips = meData.chips
        }

        renderGame()
      } catch (err) {
        console.error('Refresh game error:', err.message, err.stack)
      }
    }

    /* ---------- RENDER GAME ---------- */
    function renderGame() {
      if (!currentGame || !myHand) return

      const phase = currentGame.phase
      phaseBadge.textContent = phase.charAt(0).toUpperCase() + phase.slice(1)
      potDisplay.textContent = currentGame.pot
      potCenter.textContent = currentGame.pot
      myChipsDisplay.textContent = me.chips
      potChips.innerHTML = chipVisuals(currentGame.pot)

      // My cards
      if (myHand.cards && Array.isArray(myHand.cards)) {
        myCards.innerHTML = myHand.cards.map(c => cardHtml(c)).join('')
        const eval_ = evaluateHand(myHand.cards)
        handLabel.textContent = eval_.name
      }

      // Opponents
      const opponents = gamePlayers.filter(p => p.id !== me.id)
      const isReveal = phase === 'reveal' || phase === 'finished'
      opponentsRow.innerHTML = opponents.map(opp => {
        const oppHand = allHands.find(h => h.player_id === opp.id)
        const isCurrentTurn = currentGame.current_turn_player_id === opp.id
        const folded = oppHand?.has_folded
        let cardsHtml = ''
        if (isReveal && oppHand?.cards && !folded) {
          cardsHtml = oppHand.cards.map(c => cardHtml(c, true)).join('')
        } else {
          cardsHtml = '<div class="mini-card"></div><div class="mini-card"></div><div class="mini-card"></div>'
        }
        const statusText = folded ? 'Folded' : (oppHand ? `Bet: ${oppHand.bet_amount}` : '')
        return `
          <div class="opponent-seat ${isCurrentTurn && phase === 'betting' ? 'active-turn' : ''} ${folded ? 'folded' : ''}">
            <div class="opp-name">${escapeHtml(opp.display_name)}</div>
            <div class="opp-cards">${cardsHtml}</div>
            <div class="opp-bet">${isReveal && oppHand && !folded ? oppHand.hand_name : ''}</div>
            <div class="opp-status">${statusText}</div>
          </div>
        `
      }).join('')

      // Controls
      betControls.hidden = true
      bluffControls.hidden = true
      callBluffControls.hidden = true

      if (phase === 'betting') {
        const isMyTurn = currentGame.current_turn_player_id === me.id
        if (isMyTurn && !myHand.has_folded && !myHand.has_acted) {
          betControls.hidden = false
          gameMessage.textContent = 'Your turn! Bet, call, or fold.'
          // Update call button text
          const callBtn = betControls.querySelector('[data-action="call"]')
          if (currentGame.current_bet > 0 && myHand.bet_amount < currentGame.current_bet) {
            const callAmount = currentGame.current_bet - myHand.bet_amount
            callBtn.textContent = `Call (${callAmount})`
          } else {
            callBtn.textContent = 'Check'
          }
        } else if (myHand.has_folded) {
          gameMessage.textContent = 'You folded this round.'
        } else {
          const currentPlayer = gamePlayers.find(p => p.id === currentGame.current_turn_player_id)
          gameMessage.textContent = currentPlayer
            ? `Waiting for ${currentPlayer.display_name}...`
            : 'Waiting...'
        }
      } else if (phase === 'bluffing') {
        const myBluff = gameBluffs.find(b => b.player_id === me.id)
        if (!myHand.has_folded && !myBluff) {
          bluffControls.hidden = false
          gameMessage.textContent = 'Claim your hand strength. Bluff or be honest!'
        } else if (myBluff) {
          gameMessage.textContent = `You claimed: ${RANK_NAMES[myBluff.claim_rank] || 'Unknown'}. Waiting for others...`
        } else {
          gameMessage.textContent = 'You folded. Watching the bluff phase...'
        }
      } else if (phase === 'calling') {
        // Show bluff claims to call
        if (!myHand.has_folded) {
          const otherBluffs = gameBluffs.filter(b => b.player_id !== me.id && !b.called_by)
          if (otherBluffs.length > 0) {
            callBluffControls.hidden = false
            bluffClaims.innerHTML = otherBluffs.map(b => `
              <div class="bluff-claim-card">
                <div class="bluff-claim-info">
                  <div class="bluff-claim-name">${escapeHtml(b.player_name)}</div>
                  <div class="bluff-claim-text">Claims: ${RANK_NAMES[b.claim_rank] || 'Unknown'}</div>
                </div>
                <button class="btn btn-callbluff" data-bluff-id="${b.id}" data-target="${b.player_id}">Call Bluff!</button>
              </div>
            `).join('')

            // Attach listeners
            bluffClaims.querySelectorAll('.btn-callbluff').forEach(btn => {
              btn.addEventListener('click', () => callBluff(btn.dataset.bluffId, btn.dataset.target))
            })
          }
          gameMessage.textContent = 'Call someone\'s bluff or wait for reveal!'
        } else {
          gameMessage.textContent = 'You folded. Watching...'
        }
        // Auto-proceed check
        checkAutoReveal()
      } else if (phase === 'reveal' || phase === 'finished') {
        gameMessage.textContent = 'Round over! Hands revealed.'
        showResults()
      }
    }

    /* ---------- BETTING ACTIONS ---------- */
    betControls.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-bet')
      if (!btn || btn.disabled) return
      const action = btn.dataset.action
      const amount = parseInt(btn.dataset.amount) || 0

      try {
        // Disable all buttons
        betControls.querySelectorAll('.btn').forEach(b => b.disabled = true)

        if (action === 'fold') {
          await supabase.from(T_HANDS).update({ has_folded: true, has_acted: true })
            .eq('game_id', currentGame.game_id).eq('player_id', me.id)

          await logAction('fold', 0, `${me.display_name} folds`)
        } else if (action === 'call') {
          const callAmount = Math.max(0, currentGame.current_bet - myHand.bet_amount)
          const actualCall = Math.min(callAmount, me.chips)

          await supabase.from(T_HANDS).update({
            bet_amount: myHand.bet_amount + actualCall,
            has_acted: true
          }).eq('game_id', currentGame.game_id).eq('player_id', me.id)

          await supabase.from(T_PLAYERS).update({
            chips: me.chips - actualCall
          }).eq('id', me.id)

          await supabase.from(T_GAMES).update({
            pot: currentGame.pot + actualCall
          }).eq('game_id', currentGame.game_id)

          me.chips -= actualCall
          const label = actualCall === 0 ? 'checks' : `calls ${actualCall}`
          await logAction('call', actualCall, `${me.display_name} ${label}`)
        } else if (action === 'bet') {
          const betAmount = Math.min(amount, me.chips)
          if (betAmount <= 0) return

          const newBet = myHand.bet_amount + betAmount
          const isRaise = newBet > currentGame.current_bet

          await supabase.from(T_HANDS).update({
            bet_amount: newBet,
            has_acted: true
          }).eq('game_id', currentGame.game_id).eq('player_id', me.id)

          await supabase.from(T_PLAYERS).update({
            chips: me.chips - betAmount
          }).eq('id', me.id)

          const updates = { pot: currentGame.pot + betAmount }
          if (isRaise) {
            updates.current_bet = newBet
            // Reset has_acted for others to give them a chance to respond
            const otherHands = allHands.filter(h => h.player_id !== me.id && !h.has_folded)
            for (const h of otherHands) {
              await supabase.from(T_HANDS).update({ has_acted: false })
                .eq('game_id', currentGame.game_id).eq('player_id', h.player_id)
            }
          }
          await supabase.from(T_GAMES).update(updates).eq('game_id', currentGame.game_id)

          me.chips -= betAmount
          const label = isRaise ? `raises to ${newBet}` : `bets ${betAmount}`
          await logAction('bet', betAmount, `${me.display_name} ${label}`)
        }

        // Advance turn
        await advanceTurn()

      } catch (err) {
        console.error('Bet action error:', err.message, err.stack)
      } finally {
        betControls.querySelectorAll('.btn').forEach(b => b.disabled = false)
      }
    })

    async function advanceTurn() {
      try {
        // Reload hands to get latest state
        const { data: hands } = await supabase
          .from(T_HANDS).select('*').eq('game_id', currentGame.game_id)
        allHands = hands || []

        const activeHands = allHands.filter(h => !h.has_folded)

        // Check if only one player left
        if (activeHands.length <= 1) {
          await supabase.from(T_GAMES).update({ phase: 'reveal' })
            .eq('game_id', currentGame.game_id)
          return
        }

        // Check if all active players have acted
        const allActed = activeHands.every(h => h.has_acted)
        if (allActed) {
          // Move to bluff phase
          await supabase.from(T_GAMES).update({ phase: 'bluffing' })
            .eq('game_id', currentGame.game_id)
          return
        }

        // Find next active player
        const turnOrder = currentGame.turn_order || []
        let idx = currentGame.turn_index
        for (let i = 0; i < turnOrder.length; i++) {
          idx = (idx + 1) % turnOrder.length
          const pid = turnOrder[idx]
          const hand = allHands.find(h => h.player_id === pid)
          if (hand && !hand.has_folded && !hand.has_acted) {
            await supabase.from(T_GAMES).update({
              current_turn_player_id: pid,
              turn_index: idx
            }).eq('game_id', currentGame.game_id)
            return
          }
        }

        // If we get here, everyone has acted
        await supabase.from(T_GAMES).update({ phase: 'bluffing' })
          .eq('game_id', currentGame.game_id)
      } catch (err) {
        console.error('Advance turn error:', err.message)
      }
    }

    /* ---------- BLUFF PHASE ---------- */
    bluffControls.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-bluff')
      if (!btn) return
      const claimRank = parseInt(btn.dataset.rank)

      try {
        bluffControls.querySelectorAll('.btn').forEach(b => b.disabled = true)

        await supabase.from(T_BLUFFS).insert({
          game_id: currentGame.game_id,
          player_id: me.id,
          player_name: me.display_name,
          claim_text: RANK_NAMES[claimRank],
          claim_rank: claimRank
        })

        await logAction('bluff', 0, `${me.display_name} claims ${RANK_NAMES[claimRank]}`)

        // Check if all active non-folded players have bluffed
        const activeHands = allHands.filter(h => !h.has_folded)
        const { data: bluffs } = await supabase
          .from(T_BLUFFS).select('*').eq('game_id', currentGame.game_id)

        if (bluffs && bluffs.length >= activeHands.length) {
          await supabase.from(T_GAMES).update({ phase: 'calling' })
            .eq('game_id', currentGame.game_id)
        }
      } catch (err) {
        console.error('Bluff error:', err.message, err.stack)
      } finally {
        bluffControls.querySelectorAll('.btn').forEach(b => b.disabled = false)
      }
    })

    /* ---------- CALL BLUFF ---------- */
    async function callBluff(bluffId, targetPlayerId) {
      try {
        const targetHand = allHands.find(h => h.player_id === targetPlayerId)
        const targetBluff = gameBluffs.find(b => b.id === bluffId)
        if (!targetHand || !targetBluff) return

        const actualRank = targetHand.hand_rank
        const claimedRank = targetBluff.claim_rank
        const isBluffCaught = actualRank < claimedRank

        // Update bluff record
        await supabase.from(T_BLUFFS).update({
          called_by: me.id,
          result: isBluffCaught ? 'caught' : 'legit'
        }).eq('id', bluffId)

        // Calculate penalty: double pot entry
        const penalty = Math.min(currentGame.pot, 200)

        if (isBluffCaught) {
          // Bluffer loses chips
          const targetPlayer = gamePlayers.find(p => p.id === targetPlayerId)
          await supabase.from(T_PLAYERS).update({
            chips: Math.max(0, (targetPlayer?.chips || 500) - penalty)
          }).eq('id', targetPlayerId)

          await supabase.from(T_PLAYERS).update({
            chips: me.chips + penalty
          }).eq('id', me.id)

          await logAction('callbluff', penalty, `${me.display_name} caught ${targetBluff.player_name}'s bluff! Won ${penalty} chips.`)
        } else {
          // Caller loses chips
          await supabase.from(T_PLAYERS).update({
            chips: Math.max(0, me.chips - penalty)
          }).eq('id', me.id)

          const targetPlayer = gamePlayers.find(p => p.id === targetPlayerId)
          await supabase.from(T_PLAYERS).update({
            chips: (targetPlayer?.chips || 500) + penalty
          }).eq('id', targetPlayerId)

          await logAction('callbluff', penalty, `${me.display_name} called ${targetBluff.player_name}'s bluff but they were legit! Lost ${penalty} chips.`)
        }

        // Move to reveal
        await supabase.from(T_GAMES).update({ phase: 'reveal' })
          .eq('game_id', currentGame.game_id)

      } catch (err) {
        console.error('Call bluff error:', err.message, err.stack)
      }
    }

    async function checkAutoReveal() {
      // If 5 seconds pass, auto-reveal (simplified: skip if no calls after a moment)
      // For now, add a "Skip to Reveal" button
      if (!callBluffControls.hidden) {
        const existing = callBluffControls.querySelector('.skip-reveal-btn')
        if (!existing) {
          const skipBtn = document.createElement('button')
          skipBtn.className = 'btn btn-ghost skip-reveal-btn'
          skipBtn.textContent = 'Skip to Reveal'
          skipBtn.style.marginTop = '12px'
          skipBtn.addEventListener('click', async () => {
            await supabase.from(T_GAMES).update({ phase: 'reveal' })
              .eq('game_id', currentGame.game_id)
          })
          callBluffControls.appendChild(skipBtn)
        }
      }
    }

    /* ---------- RESULTS ---------- */
    function showResults() {
      if (!currentGame || currentGame.phase === 'finished') {
        // Already shown, don't double-show
        if (!resultsOverlay.hidden) return
      }
      resultsOverlay.hidden = false

      const activeHands = allHands.filter(h => !h.has_folded)
      const sorted = [...activeHands].sort((a, b) => {
        if (b.hand_rank !== a.hand_rank) return b.hand_rank - a.hand_rank
        // Tiebreak by highest card
        const aMax = Math.max(...(a.cards || []).map(c => VAL_MAP[c.value] || 0))
        const bMax = Math.max(...(b.cards || []).map(c => VAL_MAP[c.value] || 0))
        return bMax - aMax
      })

      const winner = sorted[0]
      const winnerPlayer = gamePlayers.find(p => p.id === winner?.player_id)
      const isMe = winner?.player_id === me.id

      resultsTitle.textContent = isMe ? '🏆 You Win!' : `🏆 ${winnerPlayer?.display_name || 'Unknown'} Wins!`

      let html = `<p class="results-winnings">Pot: 🪙 ${currentGame.pot} chips</p>`

      // Show all hands
      sorted.forEach((h, i) => {
        const p = gamePlayers.find(pl => pl.id === h.player_id)
        const cards = (h.cards || []).map(c => `${c.value}${c.suit}`).join(' ')
        html += `
          <div class="results-player ${i === 0 ? 'winner' : ''}">
            <div class="rp-name">${i === 0 ? '👑 ' : ''}${escapeHtml(p?.display_name || 'Unknown')}</div>
            <div class="rp-hand">${h.hand_name}</div>
            <div class="rp-cards">${cards}</div>
          </div>
        `
      })

      // Show folded players
      const folded = allHands.filter(h => h.has_folded)
      folded.forEach(h => {
        const p = gamePlayers.find(pl => pl.id === h.player_id)
        html += `
          <div class="results-player">
            <div class="rp-name">${escapeHtml(p?.display_name || 'Unknown')}</div>
            <div class="rp-hand" style="color:var(--muted);">Folded</div>
          </div>
        `
      })

      resultsBody.innerHTML = html

      // Award pot to winner
      if (winner && currentGame.phase !== 'finished') {
        awardWinner(winner.player_id)
      }
    }

    async function awardWinner(winnerId) {
      try {
        const winnerPlayer = gamePlayers.find(p => p.id === winnerId)
        if (!winnerPlayer) return

        await supabase.from(T_PLAYERS).update({
          chips: winnerPlayer.chips + currentGame.pot,
          wins: (winnerPlayer.wins || 0) + 1,
          total_earnings: (winnerPlayer.total_earnings || 0) + currentGame.pot
        }).eq('id', winnerId)

        // Mark losses for others
        const losers = gamePlayers.filter(p => p.id !== winnerId)
        for (const loser of losers) {
          await supabase.from(T_PLAYERS).update({
            losses: (loser.losses || 0) + 1
          }).eq('id', loser.id)
        }

        await supabase.from(T_GAMES).update({
          phase: 'finished',
          winner_id: winnerId
        }).eq('game_id', currentGame.game_id)

      } catch (err) {
        console.error('Award winner error:', err.message)
      }
    }

    /* ---------- NEXT ROUND / BACK ---------- */
    nextRoundBtn.addEventListener('click', async () => {
      try {
        resultsOverlay.hidden = true
        // Clear game id
        await supabase.from(T_PLAYERS).update({ current_game_id: null }).eq('id', me.id)
        me.current_game_id = null

        // Refresh my data
        const { data } = await supabase.from(T_PLAYERS).select('*').eq('id', me.id).single()
        if (data) me = data

        cleanupSubscriptions()
        showView('lobby')
        startLobby()
      } catch (err) {
        console.error('Next round error:', err.message)
      }
    })

    backToLobbyBtn.addEventListener('click', async () => {
      try {
        resultsOverlay.hidden = true
        await supabase.from(T_PLAYERS).update({ current_game_id: null }).eq('id', me.id)
        me.current_game_id = null

        const { data } = await supabase.from(T_PLAYERS).select('*').eq('id', me.id).single()
        if (data) me = data

        cleanupSubscriptions()
        showView('lobby')
        startLobby()
      } catch (err) {
        console.error('Back to lobby error:', err.message)
      }
    })

    /* ---------- ACTION LOG ---------- */
    async function logAction(type, amount, message) {
      try {
        await supabase.from(T_ACTIONS).insert({
          game_id: currentGame.game_id,
          player_id: me.id,
          player_name: me.display_name,
          action_type: type,
          amount: amount,
          message: message,
          phase: currentGame.phase
        })
      } catch (err) {
        console.error('Log action error:', err.message)
      }
    }

    function addLogEntry(action) {
      const entry = document.createElement('div')
      entry.className = 'log-entry'
      const msg = escapeHtml(action.message || `${action.player_name} ${action.action_type}`)
      let colorClass = ''
      if (action.action_type === 'fold') colorClass = 'log-red'
      else if (action.action_type === 'call' || action.action_type === 'bet') colorClass = 'log-gold'
      else if (action.action_type === 'callbluff') colorClass = 'log-green'

      entry.innerHTML = `<span class="${colorClass}">${msg}</span>`
      actionLog.prepend(entry)
    }

    /* ---------- CLEANUP ---------- */
    function cleanupSubscriptions() {
      subscriptions.forEach(s => {
        try { supabase.removeChannel(s) } catch (e) { /* ignore */ }
      })
      subscriptions = []
    }

    /* ---------- HEARTBEAT ---------- */
    setInterval(async () => {
      if (me) {
        try {
          await supabase.from(T_PLAYERS).update({
            last_seen: new Date().toISOString(),
            is_online: true
          }).eq('id', me.id)
        } catch (e) { /* ignore */ }
      }
    }, 15000)

    /* ---------- CLEANUP ON UNLOAD ---------- */
    window.addEventListener('beforeunload', () => {
      if (me) {
        navigator.sendBeacon && navigator.sendBeacon(
          `${SUPABASE_URL}/rest/v1/${T_PLAYERS}?id=eq.${me.id}`,
          '{}' // Can't really PATCH via beacon, but we try
        )
      }
    })

  } catch (err) {
    console.error('App bootstrap error:', err.message, err.stack)
    document.body.innerHTML = `
      <div style="min-height:100vh;display:grid;place-items:center;background:#041a0e;color:white;font-family:Inter,sans-serif;padding:24px;">
        <div style="max-width:480px;text-align:center;">
          <h1 style="font-size:1.5rem;color:#d4a843;margin-bottom:12px;">Failed to load Bluff Poker</h1>
          <p style="color:#8aab8a;">${err.message}</p>
        </div>
      </div>
    `
  }
})()

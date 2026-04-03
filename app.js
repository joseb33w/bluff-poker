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

    /* ========== SOUND ENGINE ========== */
    let audioCtx = null
    let isMuted = false

    function getAudioCtx() {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      return audioCtx
    }

    function playTone(freq, duration, type = 'sine', vol = 0.15) {
      if (isMuted) return
      try {
        const ctx = getAudioCtx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = type
        osc.frequency.value = freq
        gain.gain.setValueAtTime(vol, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + duration)
      } catch (e) { /* ignore audio errors */ }
    }

    const SFX = {
      deal() { playTone(800, 0.08, 'triangle', 0.12); setTimeout(() => playTone(600, 0.06, 'triangle', 0.1), 60) },
      bet() { playTone(500, 0.1, 'square', 0.08); setTimeout(() => playTone(700, 0.08, 'square', 0.06), 50) },
      fold() { playTone(300, 0.15, 'sawtooth', 0.06) },
      win() { [0, 100, 200, 300].forEach((d, i) => setTimeout(() => playTone(523 + i * 100, 0.15, 'sine', 0.12), d)) },
      lose() { playTone(300, 0.3, 'sawtooth', 0.1); setTimeout(() => playTone(200, 0.4, 'sawtooth', 0.08), 200) },
      bluff() { playTone(400, 0.12, 'square', 0.1); setTimeout(() => playTone(600, 0.1, 'triangle', 0.08), 80) },
      callBluff() { playTone(900, 0.1, 'sine', 0.12); setTimeout(() => playTone(1100, 0.15, 'sine', 0.1), 100) },
      click() { playTone(1000, 0.04, 'sine', 0.08) }
    }

    /* ========== DOM ========== */
    const $ = id => document.getElementById(id)
    const views = { join: $('joinView'), lobby: $('lobbyView'), game: $('gameView') }
    const joinForm = $('joinForm')
    const nameInput = $('nameInput')
    const joinStatus = $('joinStatus')
    const playersGrid = $('playersGrid')
    const leaderboardList = $('leaderboardList')
    const startGameBtn = $('startGameBtn')
    const leaveLobbyBtn = $('leaveLobbyBtn')
    const playAIBtn = $('playAIBtn')
    const aiPicker = $('aiPicker')
    const aiCancelBtn = $('aiCancelBtn')
    const aiBadge = $('aiBadge')
    const muteBtn = $('muteBtn')
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

    /* ========== STATE ========== */
    let me = null
    let sessionId = crypto.randomUUID()
    let currentGame = null
    let myHand = null
    let allHands = []
    let allPlayers = []
    let gamePlayers = []
    let gameActions = []
    let gameBluffs = []
    let subscriptions = []

    /* --- AI STATE --- */
    let isAIGame = false
    let aiDifficulty = 'medium'
    let aiPlayer = null
    let aiHand = null
    let aiBluff = null
    let localGame = null
    let localMyHand = null
    let localAIHand = null
    let localBluffs = []
    let localActions = []
    let aiThinking = false

    const AI_NAMES = {
      easy: '😎 Easy Bot',
      medium: '🧠 Medium Bot',
      hard: '🔥 Hard Bot',
      chaos: '🃏 Chaos Bot'
    }

    /* ========== UTILS ========== */
    function showView(name) {
      Object.entries(views).forEach(([k, el]) => el.classList.toggle('active', k === name))
    }

    function escapeHtml(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

    /* ========== CARD & HAND LOGIC ========== */
    const SUITS = ['♥', '♦', '♣', '♠']
    const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
    const VAL_MAP = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 }

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
        (sorted[0] === 2 && sorted[1] === 3 && sorted[2] === 14)

      const counts = {}
      vals.forEach(v => { counts[v] = (counts[v] || 0) + 1 })
      const freqs = Object.values(counts).sort((a, b) => b - a)

      if (isFlush && isStraight) return { rank: 7, name: 'Straight Flush' }
      if (isFlush) return { rank: 6, name: 'Flush' }
      if (isStraight) return { rank: 5, name: 'Straight' }
      if (freqs[0] === 3) return { rank: 4, name: 'Three of a Kind' }
      if (freqs[0] === 2) return { rank: 2, name: 'Pair' }
      return { rank: 1, name: 'High Card' }
    }

    const RANK_NAMES = { 1: 'High Card', 2: 'Pair', 3: 'Two Pair', 4: 'Three of a Kind', 5: 'Straight', 6: 'Flush', 7: 'Straight Flush' }

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

    /* ========== MUTE TOGGLE ========== */
    muteBtn.addEventListener('click', () => {
      isMuted = !isMuted
      muteBtn.classList.toggle('muted', isMuted)
      SFX.click()
    })

    /* ========== USER PERSISTENCE ========== */
    async function tryAutoLogin() {
      const savedId = localStorage.getItem('bluff_poker_player_id')
      const savedName = localStorage.getItem('bluff_poker_name')

      if (savedName) {
        nameInput.value = savedName
      }

      if (!savedId) return false

      try {
        joinStatus.textContent = 'Reconnecting...'
        const { data, error } = await supabase
          .from(T_PLAYERS)
          .select('*')
          .eq('id', savedId)
          .single()

        if (error || !data) {
          // Player was deleted or doesn't exist
          localStorage.removeItem('bluff_poker_player_id')
          localStorage.removeItem('bluff_poker_name')
          joinStatus.textContent = ''
          return false
        }

        // Update player to online
        const { data: updated, error: updateErr } = await supabase
          .from(T_PLAYERS)
          .update({
            is_online: true,
            session_id: sessionId,
            last_seen: new Date().toISOString()
          })
          .eq('id', savedId)
          .select()
          .single()

        if (updateErr || !updated) {
          joinStatus.textContent = ''
          return false
        }

        me = updated
        joinStatus.textContent = ''
        return true
      } catch (err) {
        console.warn('Auto-login failed:', err.message)
        joinStatus.textContent = ''
        return false
      }
    }

    /* ========== JOIN ========== */
    joinForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      try {
        const name = nameInput.value.trim()
        if (!name || name.length < 2) {
          joinStatus.textContent = 'Name must be at least 2 characters.'
          return
        }
        joinStatus.textContent = 'Joining...'
        SFX.click()

        // Check if name taken by another online player
        const { data: existing } = await supabase
          .from(T_PLAYERS)
          .select('id, session_id, is_online')
          .eq('display_name', name)
          .eq('is_online', true)
          .limit(1)

        if (existing && existing.length > 0) {
          joinStatus.textContent = 'That name is already taken. Try another.'
          return
        }

        // Insert new player
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

        // Save to localStorage for persistence
        localStorage.setItem('bluff_poker_player_id', me.id)
        localStorage.setItem('bluff_poker_name', name)

        joinStatus.textContent = ''
        showView('lobby')
        startLobby()
      } catch (err) {
        console.error('Join error:', err.message, err.stack)
        joinStatus.textContent = err.message || 'Failed to join.'
      }
    })

    /* ========== LOBBY ========== */
    async function startLobby() {
      await loadLobbyPlayers()
      await loadLeaderboard()

      const playerSub = supabase.channel('lobby-players')
        .on('postgres_changes', { event: '*', schema: 'public', table: T_PLAYERS }, () => {
          loadLobbyPlayers()
          loadLeaderboard()
        })
        .subscribe()
      subscriptions.push(playerSub)

      const gameSub = supabase.channel('lobby-games')
        .on('postgres_changes', { event: '*', schema: 'public', table: T_GAMES }, (payload) => {
          if (payload.new && payload.new.status === 'active' && me.current_game_id === null) {
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

    /* ========== START MULTIPLAYER GAME ========== */
    startGameBtn.addEventListener('click', async () => {
      try {
        startGameBtn.disabled = true
        SFX.click()
        const gameId = crypto.randomUUID()

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

        for (const pid of playerIds) {
          await supabase.from(T_PLAYERS).update({ current_game_id: gameId }).eq('id', pid)
        }

        me.current_game_id = gameId
        isAIGame = false
        aiBadge.hidden = true
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
          const { data } = await supabase.from(T_PLAYERS).select('*').eq('id', me.id).single()
          if (data) me = data
          if (me.current_game_id) {
            isAIGame = false
            aiBadge.hidden = true
            enterGame(me.current_game_id)
          }
        }
      } catch (err) {
        console.error('Check game error:', err.message)
      }
    }

    /* ========== LEAVE LOBBY ========== */
    leaveLobbyBtn.addEventListener('click', async () => {
      try {
        SFX.click()
        await supabase.from(T_PLAYERS).update({ is_online: false }).eq('id', me.id)
        cleanupSubscriptions()
        me = null
        showView('join')
      } catch (err) {
        console.error('Leave error:', err.message)
      }
    })

    /* ========== AI GAME MODE ========== */
    playAIBtn.addEventListener('click', () => {
      SFX.click()
      aiPicker.hidden = false
    })

    aiCancelBtn.addEventListener('click', () => {
      SFX.click()
      aiPicker.hidden = true
    })

    // Difficulty button listeners
    aiPicker.querySelectorAll('.ai-diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        SFX.click()
        const diff = btn.dataset.diff
        aiPicker.hidden = true
        startAIGame(diff)
      })
    })

    function startAIGame(difficulty) {
      isAIGame = true
      aiDifficulty = difficulty
      aiThinking = false
      localBluffs = []
      localActions = []

      aiPlayer = {
        id: 'ai-bot',
        display_name: AI_NAMES[difficulty] || '🤖 Bot',
        chips: 500
      }

      // Deal cards
      const deck = shuffle(newDeck())
      const myCards_ = [deck[0], deck[1], deck[2]]
      const aiCards = [deck[3], deck[4], deck[5]]
      const myEval = evaluateHand(myCards_)
      const aiEval = evaluateHand(aiCards)

      localMyHand = {
        player_id: me.id,
        cards: myCards_,
        hand_rank: myEval.rank,
        hand_name: myEval.name,
        has_folded: false,
        bet_amount: 0,
        has_acted: false
      }

      localAIHand = {
        player_id: 'ai-bot',
        cards: aiCards,
        hand_rank: aiEval.rank,
        hand_name: aiEval.name,
        has_folded: false,
        bet_amount: 0,
        has_acted: false
      }

      // Randomly decide who goes first
      const meFirst = Math.random() > 0.5

      localGame = {
        game_id: 'ai-' + crypto.randomUUID(),
        status: 'active',
        phase: 'betting',
        pot: 0,
        current_bet: 0,
        current_turn_player_id: meFirst ? me.id : 'ai-bot',
        turn_order: meFirst ? [me.id, 'ai-bot'] : ['ai-bot', me.id],
        turn_index: 0,
        round_number: 1
      }

      // Mirror into the shared variables for renderGame
      currentGame = localGame
      myHand = localMyHand
      allHands = [localMyHand, localAIHand]
      gamePlayers = [me, aiPlayer]
      gameBluffs = localBluffs

      cleanupSubscriptions()
      showView('game')
      aiBadge.hidden = false
      resultsOverlay.hidden = true
      actionLog.innerHTML = ''

      SFX.deal()
      renderGame()

      // If AI goes first in betting, trigger AI turn
      if (!meFirst) {
        aiTakeBettingTurn()
      }
    }

    /* --- AI DECISION ENGINE --- */
    function aiDecideBet() {
      const hand = localAIHand
      const rank = hand.hand_rank
      const currentBet = localGame.current_bet
      const myBet = hand.bet_amount
      const callCost = Math.max(0, currentBet - myBet)
      const chips = aiPlayer.chips

      switch (aiDifficulty) {
        case 'easy': return aiDecideEasy(rank, callCost, chips)
        case 'medium': return aiDecideMedium(rank, callCost, chips)
        case 'hard': return aiDecideHard(rank, callCost, chips)
        case 'chaos': return aiDecideChaos(callCost, chips)
        default: return aiDecideMedium(rank, callCost, chips)
      }
    }

    function aiDecideEasy(rank, callCost, chips) {
      // Conservative: mostly calls/checks, folds weak hands vs big bets
      if (callCost > 0) {
        if (rank <= 1 && callCost > 25) return { action: 'fold' }
        if (rank <= 1 && Math.random() < 0.3) return { action: 'fold' }
        return { action: 'call' }
      }
      // No bet to call — check or small bet
      if (rank >= 4) return { action: 'bet', amount: 10 }
      if (rank >= 2 && Math.random() < 0.3) return { action: 'bet', amount: 10 }
      return { action: 'call' } // check
    }

    function aiDecideMedium(rank, callCost, chips) {
      if (callCost > 0) {
        if (rank <= 1 && callCost > 50) return { action: 'fold' }
        if (rank <= 1 && callCost > 25 && Math.random() < 0.4) return { action: 'fold' }
        if (rank >= 4) return { action: 'bet', amount: Math.min(25, chips) } // re-raise
        return { action: 'call' }
      }
      // No bet — decide to bet or check
      if (rank >= 5) return { action: 'bet', amount: Math.min(50, chips) }
      if (rank >= 4) return { action: 'bet', amount: Math.min(25, chips) }
      if (rank >= 2) return { action: 'bet', amount: Math.min(10, chips) }
      if (Math.random() < 0.2) return { action: 'bet', amount: Math.min(10, chips) } // occasional bluff bet
      return { action: 'call' }
    }

    function aiDecideHard(rank, callCost, chips) {
      // Look at player's betting pattern for this round
      const playerBet = localMyHand.bet_amount
      const playerActed = localMyHand.has_acted

      if (callCost > 0) {
        // Player raised — analyze
        if (rank >= 4) {
          // Strong hand, re-raise
          return { action: 'bet', amount: Math.min(callCost + 25, chips) }
        }
        if (rank >= 2) {
          // Decent hand, call
          if (callCost > 75 && Math.random() < 0.3) return { action: 'fold' }
          return { action: 'call' }
        }
        // Weak hand
        if (callCost > 50) return { action: 'fold' }
        if (callCost > 25 && Math.random() < 0.5) return { action: 'fold' }
        // Bluff raise with weak hand sometimes
        if (Math.random() < 0.25) return { action: 'bet', amount: Math.min(callCost + 50, chips) }
        return { action: 'call' }
      }

      // No bet to call
      if (rank >= 5) return { action: 'bet', amount: Math.min(50, chips) }
      if (rank >= 4) return { action: 'bet', amount: Math.min(25, chips) }
      if (rank >= 2) return { action: 'bet', amount: Math.min(10, chips) }
      // Bluff with nothing
      if (Math.random() < 0.35) return { action: 'bet', amount: Math.min(25, chips) }
      return { action: 'call' }
    }

    function aiDecideChaos(callCost, chips) {
      const r = Math.random()
      if (callCost > 0) {
        if (r < 0.15) return { action: 'fold' }
        if (r < 0.5) return { action: 'call' }
        const amounts = [10, 25, 50, 100]
        return { action: 'bet', amount: Math.min(amounts[Math.floor(Math.random() * amounts.length)], chips) }
      }
      if (r < 0.3) return { action: 'call' } // check
      const amounts = [10, 25, 50, 100]
      return { action: 'bet', amount: Math.min(amounts[Math.floor(Math.random() * amounts.length)], chips) }
    }

    function aiDecideBluffClaim() {
      const actualRank = localAIHand.hand_rank
      switch (aiDifficulty) {
        case 'easy':
          // Honest or slightly over-claims
          if (Math.random() < 0.7) return actualRank
          return Math.min(actualRank + 1, 6)
        case 'medium':
          // Sometimes bluffs up by 1-2 ranks
          if (Math.random() < 0.5) return actualRank
          return Math.min(actualRank + Math.ceil(Math.random() * 2), 6)
        case 'hard':
          // Strategic: bluffs high with weak hands, honest with strong
          if (actualRank >= 4) return actualRank // no need to bluff
          if (Math.random() < 0.5) return Math.min(actualRank + 2, 6)
          return Math.min(actualRank + 1, 6)
        case 'chaos':
          // Completely random claim
          return Math.ceil(Math.random() * 6)
        default:
          return actualRank
      }
    }

    function aiDecideCallBluff(playerClaimRank) {
      const playerActualRank = localMyHand.hand_rank // AI "knows" nothing, but difficulty affects suspicion
      const aiRank = localAIHand.hand_rank

      switch (aiDifficulty) {
        case 'easy':
          // Rarely calls bluffs
          return Math.random() < 0.15
        case 'medium':
          // Calls if claim seems too high
          if (playerClaimRank >= 5) return Math.random() < 0.4
          if (playerClaimRank >= 4) return Math.random() < 0.25
          return Math.random() < 0.1
        case 'hard':
          // More strategic — compares to own hand
          if (playerClaimRank >= 5 && aiRank < 4) return Math.random() < 0.55
          if (playerClaimRank >= 4) return Math.random() < 0.35
          if (playerClaimRank <= 2) return Math.random() < 0.05 // why call a low claim
          return Math.random() < 0.2
        case 'chaos':
          return Math.random() < 0.5
        default:
          return Math.random() < 0.25
      }
    }

    /* --- AI TURN EXECUTION --- */
    async function aiTakeBettingTurn() {
      if (!isAIGame || localGame.phase !== 'betting') return
      if (localAIHand.has_folded || localAIHand.has_acted) return

      aiThinking = true
      renderGame()

      await sleep(1200 + Math.random() * 800)

      const decision = aiDecideBet()
      aiThinking = false

      if (decision.action === 'fold') {
        localAIHand.has_folded = true
        localAIHand.has_acted = true
        addLocalLog(`${aiPlayer.display_name} folds`, 'log-red')
        SFX.fold()
      } else if (decision.action === 'call') {
        const callAmount = Math.max(0, localGame.current_bet - localAIHand.bet_amount)
        const actualCall = Math.min(callAmount, aiPlayer.chips)
        localAIHand.bet_amount += actualCall
        localAIHand.has_acted = true
        aiPlayer.chips -= actualCall
        localGame.pot += actualCall
        const label = actualCall === 0 ? 'checks' : `calls ${actualCall}`
        addLocalLog(`${aiPlayer.display_name} ${label}`, 'log-gold')
        SFX.bet()
      } else if (decision.action === 'bet') {
        const betAmount = Math.min(decision.amount, aiPlayer.chips)
        if (betAmount <= 0) {
          localAIHand.has_acted = true
        } else {
          const newBet = localAIHand.bet_amount + betAmount
          const isRaise = newBet > localGame.current_bet

          localAIHand.bet_amount = newBet
          localAIHand.has_acted = true
          aiPlayer.chips -= betAmount
          localGame.pot += betAmount

          if (isRaise) {
            localGame.current_bet = newBet
            // Reset player's has_acted so they get a chance to respond
            localMyHand.has_acted = false
          }

          const label = isRaise ? `raises to ${newBet}` : `bets ${betAmount}`
          addLocalLog(`${aiPlayer.display_name} ${label}`, 'log-gold')
          SFX.bet()
        }
      }

      aiAdvanceTurn()
    }

    function aiAdvanceTurn() {
      const active = [localMyHand, localAIHand].filter(h => !h.has_folded)

      // Only one player left
      if (active.length <= 1) {
        localGame.phase = 'reveal'
        renderGame()
        return
      }

      // Check if all acted
      const allActed = active.every(h => h.has_acted)
      if (allActed) {
        localGame.phase = 'bluffing'
        localBluffs = []
        gameBluffs = localBluffs
        renderGame()
        // If AI goes first in bluff phase, let AI bluff
        if (localGame.turn_order[0] === 'ai-bot') {
          aiTakeBluffTurn()
        }
        return
      }

      // Find next player who hasn't acted
      const turnOrder = localGame.turn_order
      let idx = localGame.turn_index
      for (let i = 0; i < turnOrder.length; i++) {
        idx = (idx + 1) % turnOrder.length
        const pid = turnOrder[idx]
        const hand = pid === me.id ? localMyHand : localAIHand
        if (!hand.has_folded && !hand.has_acted) {
          localGame.current_turn_player_id = pid
          localGame.turn_index = idx
          renderGame()
          if (pid === 'ai-bot') {
            aiTakeBettingTurn()
          }
          return
        }
      }

      // Fallback: everyone acted
      localGame.phase = 'bluffing'
      localBluffs = []
      gameBluffs = localBluffs
      renderGame()
      if (localGame.turn_order[0] === 'ai-bot') {
        aiTakeBluffTurn()
      }
    }

    async function aiTakeBluffTurn() {
      if (!isAIGame || localGame.phase !== 'bluffing') return
      if (localAIHand.has_folded) return
      // Check if AI already bluffed
      if (localBluffs.find(b => b.player_id === 'ai-bot')) return

      aiThinking = true
      renderGame()

      await sleep(1000 + Math.random() * 1000)

      const claimRank = aiDecideBluffClaim()
      aiThinking = false

      const bluff = {
        id: 'ai-bluff-' + Date.now(),
        player_id: 'ai-bot',
        player_name: aiPlayer.display_name,
        claim_text: RANK_NAMES[claimRank],
        claim_rank: claimRank,
        called_by: null,
        result: null
      }
      localBluffs.push(bluff)
      gameBluffs = localBluffs

      addLocalLog(`${aiPlayer.display_name} claims ${RANK_NAMES[claimRank]}`, 'log-purple')
      SFX.bluff()

      // Check if both have bluffed
      checkBluffPhaseComplete()
    }

    function checkBluffPhaseComplete() {
      const active = [localMyHand, localAIHand].filter(h => !h.has_folded)
      const bluffCount = localBluffs.length
      if (bluffCount >= active.length) {
        localGame.phase = 'calling'
        renderGame()
        // If AI should decide whether to call player's bluff
        aiTakeCallBluffTurn()
      } else {
        renderGame()
      }
    }

    async function aiTakeCallBluffTurn() {
      if (!isAIGame || localGame.phase !== 'calling') return
      if (localAIHand.has_folded) return

      const playerBluff = localBluffs.find(b => b.player_id === me.id && !b.called_by)
      if (!playerBluff) return

      aiThinking = true
      renderGame()

      await sleep(1500 + Math.random() * 1000)
      aiThinking = false

      const shouldCall = aiDecideCallBluff(playerBluff.claim_rank)

      if (shouldCall) {
        SFX.callBluff()
        const actualRank = localMyHand.hand_rank
        const claimedRank = playerBluff.claim_rank
        const isBluffCaught = actualRank < claimedRank

        playerBluff.called_by = 'ai-bot'
        playerBluff.result = isBluffCaught ? 'caught' : 'legit'

        const penalty = Math.min(localGame.pot, 200)

        if (isBluffCaught) {
          me.chips = Math.max(0, me.chips - penalty)
          aiPlayer.chips += penalty
          addLocalLog(`${aiPlayer.display_name} caught your bluff! You lose ${penalty} chips.`, 'log-red')
        } else {
          aiPlayer.chips = Math.max(0, aiPlayer.chips - penalty)
          me.chips += penalty
          addLocalLog(`${aiPlayer.display_name} called your bluff but you were legit! Won ${penalty} chips.`, 'log-green')
        }

        localGame.phase = 'reveal'
        renderGame()
      } else {
        // AI doesn't call — go to reveal after a moment
        addLocalLog(`${aiPlayer.display_name} lets it slide...`, 'log-purple')
        renderGame()
        // Don't auto-advance — let the player decide to call AI's bluff or skip
      }
    }

    function addLocalLog(message, colorClass = '') {
      const entry = document.createElement('div')
      entry.className = 'log-entry'
      entry.innerHTML = `<span class="${colorClass}">${escapeHtml(message)}</span>`
      actionLog.prepend(entry)
      localActions.push({ message })
    }

    /* ========== AI BETTING HANDLER (player's actions in AI mode) ========== */
    function handleAIBet(action, amount = 0) {
      if (!isAIGame || localGame.phase !== 'betting') return
      if (localGame.current_turn_player_id !== me.id) return
      if (localMyHand.has_folded || localMyHand.has_acted) return

      if (action === 'fold') {
        localMyHand.has_folded = true
        localMyHand.has_acted = true
        addLocalLog(`${me.display_name} folds`, 'log-red')
        SFX.fold()
      } else if (action === 'call') {
        const callAmount = Math.max(0, localGame.current_bet - localMyHand.bet_amount)
        const actualCall = Math.min(callAmount, me.chips)
        localMyHand.bet_amount += actualCall
        localMyHand.has_acted = true
        me.chips -= actualCall
        localGame.pot += actualCall
        const label = actualCall === 0 ? 'checks' : `calls ${actualCall}`
        addLocalLog(`${me.display_name} ${label}`, 'log-gold')
        SFX.bet()
      } else if (action === 'bet') {
        const betAmount = Math.min(amount, me.chips)
        if (betAmount <= 0) return
        const newBet = localMyHand.bet_amount + betAmount
        const isRaise = newBet > localGame.current_bet

        localMyHand.bet_amount = newBet
        localMyHand.has_acted = true
        me.chips -= betAmount
        localGame.pot += betAmount

        if (isRaise) {
          localGame.current_bet = newBet
          localAIHand.has_acted = false // give AI chance to respond
        }

        const label = isRaise ? `raises to ${newBet}` : `bets ${betAmount}`
        addLocalLog(`${me.display_name} ${label}`, 'log-gold')
        SFX.bet()
      }

      aiAdvanceTurn()
    }

    function handleAIBluff(claimRank) {
      if (!isAIGame || localGame.phase !== 'bluffing') return
      if (localMyHand.has_folded) return
      if (localBluffs.find(b => b.player_id === me.id)) return

      const bluff = {
        id: 'my-bluff-' + Date.now(),
        player_id: me.id,
        player_name: me.display_name,
        claim_text: RANK_NAMES[claimRank],
        claim_rank: claimRank,
        called_by: null,
        result: null
      }
      localBluffs.push(bluff)
      gameBluffs = localBluffs
      addLocalLog(`${me.display_name} claims ${RANK_NAMES[claimRank]}`, 'log-purple')
      SFX.bluff()

      checkBluffPhaseComplete()

      // If AI hasn't bluffed yet, trigger AI bluff
      if (!localBluffs.find(b => b.player_id === 'ai-bot') && !localAIHand.has_folded) {
        aiTakeBluffTurn()
      }
    }

    function handleAICallBluff(bluffId) {
      if (!isAIGame || localGame.phase !== 'calling') return

      const targetBluff = localBluffs.find(b => b.id === bluffId)
      if (!targetBluff || targetBluff.called_by) return

      SFX.callBluff()

      const actualRank = localAIHand.hand_rank
      const claimedRank = targetBluff.claim_rank
      const isBluffCaught = actualRank < claimedRank

      targetBluff.called_by = me.id
      targetBluff.result = isBluffCaught ? 'caught' : 'legit'

      const penalty = Math.min(localGame.pot, 200)

      if (isBluffCaught) {
        aiPlayer.chips = Math.max(0, aiPlayer.chips - penalty)
        me.chips += penalty
        addLocalLog(`You caught ${aiPlayer.display_name}'s bluff! Won ${penalty} chips.`, 'log-green')
      } else {
        me.chips = Math.max(0, me.chips - penalty)
        aiPlayer.chips += penalty
        addLocalLog(`You called ${aiPlayer.display_name}'s bluff but they were legit! Lost ${penalty} chips.`, 'log-red')
      }

      localGame.phase = 'reveal'
      renderGame()
    }

    function handleAISkipToReveal() {
      if (!isAIGame) return
      localGame.phase = 'reveal'
      renderGame()
    }

    /* ========== AI RESULTS & CLEANUP ========== */
    async function finishAIGame(winnerId) {
      const isWin = winnerId === me.id

      if (isWin) {
        me.chips += localGame.pot
        SFX.win()
      } else {
        SFX.lose()
      }

      // Save updated chips to Supabase
      try {
        await supabase.from(T_PLAYERS).update({
          chips: me.chips,
          wins: isWin ? (me.wins || 0) + 1 : (me.wins || 0),
          losses: isWin ? (me.losses || 0) : (me.losses || 0) + 1,
          total_earnings: isWin ? (me.total_earnings || 0) + localGame.pot : (me.total_earnings || 0)
        }).eq('id', me.id)

        if (isWin) me.wins = (me.wins || 0) + 1
        else me.losses = (me.losses || 0) + 1
      } catch (err) {
        console.warn('Failed to save AI game results:', err.message)
      }

      localGame.phase = 'finished'
    }

    /* ========== ENTER MULTIPLAYER GAME ========== */
    async function enterGame(gameId) {
      cleanupSubscriptions()
      showView('game')
      resultsOverlay.hidden = true
      actionLog.innerHTML = ''

      await refreshGameState(gameId)

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
        const { data: games } = await supabase
          .from(T_GAMES).select('*').eq('game_id', gameId).limit(1)
        if (!games || games.length === 0) return
        currentGame = games[0]

        const { data: hands } = await supabase
          .from(T_HANDS).select('*').eq('game_id', gameId)
        allHands = hands || []
        myHand = allHands.find(h => h.player_id === me.id)

        const playerIds = currentGame.turn_order || []
        if (playerIds.length > 0) {
          const { data: players } = await supabase
            .from(T_PLAYERS).select('*').in('id', playerIds)
          gamePlayers = players || []
        }

        const { data: bluffs } = await supabase
          .from(T_BLUFFS).select('*').eq('game_id', gameId)
        gameBluffs = bluffs || []

        const meData = gamePlayers.find(p => p.id === me.id)
        if (meData) {
          me.chips = meData.chips
        }

        renderGame()
      } catch (err) {
        console.error('Refresh game error:', err.message, err.stack)
      }
    }

    /* ========== RENDER GAME (shared for multiplayer + AI) ========== */
    function renderGame() {
      if (!currentGame) return
      const hand = isAIGame ? localMyHand : myHand
      if (!hand) return

      const phase = currentGame.phase
      phaseBadge.textContent = phase.charAt(0).toUpperCase() + phase.slice(1)
      potDisplay.textContent = currentGame.pot
      potCenter.textContent = currentGame.pot
      myChipsDisplay.textContent = me.chips
      potChips.innerHTML = chipVisuals(currentGame.pot)

      // My cards
      if (hand.cards && Array.isArray(hand.cards)) {
        myCards.innerHTML = hand.cards.map(c => cardHtml(c)).join('')
        const eval_ = evaluateHand(hand.cards)
        handLabel.textContent = eval_.name
      }

      // Opponents
      const opponentsList = isAIGame ? [aiPlayer] : gamePlayers.filter(p => p.id !== me.id)
      const hands_ = isAIGame ? [localMyHand, localAIHand] : allHands
      const isReveal = phase === 'reveal' || phase === 'finished'

      opponentsRow.innerHTML = opponentsList.map(opp => {
        const oppHand = hands_.find(h => h.player_id === opp.id)
        const isCurrentTurn = currentGame.current_turn_player_id === opp.id
        const folded = oppHand?.has_folded
        const isAI = opp.id === 'ai-bot'
        let cardsHtml = ''
        if (isReveal && oppHand?.cards && !folded) {
          cardsHtml = oppHand.cards.map(c => cardHtml(c, true)).join('')
        } else {
          cardsHtml = '<div class="mini-card"></div><div class="mini-card"></div><div class="mini-card"></div>'
        }
        const statusText = folded ? 'Folded' : (oppHand ? `Bet: ${oppHand.bet_amount}` : '')
        const thinkingHtml = (aiThinking && isAI && phase === 'betting' && isCurrentTurn) || (aiThinking && isAI && (phase === 'bluffing' || phase === 'calling'))
          ? `<div class="ai-thinking"><div class="ai-thinking-dot"></div><div class="ai-thinking-dot"></div><div class="ai-thinking-dot"></div></div>`
          : ''

        return `
          <div class="opponent-seat ${isCurrentTurn && phase === 'betting' ? 'active-turn' : ''} ${folded ? 'folded' : ''} ${isAI ? 'ai-seat' : ''}">
            <div class="opp-name">${escapeHtml(opp.display_name)}</div>
            ${thinkingHtml}
            <div class="opp-cards">${cardsHtml}</div>
            <div class="opp-bet">${isReveal && oppHand && !folded ? oppHand.hand_name : ''}</div>
            <div class="opp-status">${statusText}${isAI && !folded ? ` | 🪙 ${opp.chips}` : ''}</div>
          </div>
        `
      }).join('')

      // Controls
      betControls.hidden = true
      bluffControls.hidden = true
      callBluffControls.hidden = true

      if (phase === 'betting') {
        renderBettingControls(hand)
      } else if (phase === 'bluffing') {
        renderBluffControls(hand)
      } else if (phase === 'calling') {
        renderCallingControls(hand)
      } else if (phase === 'reveal' || phase === 'finished') {
        gameMessage.textContent = 'Round over! Hands revealed.'
        showResults()
      }
    }

    function renderBettingControls(hand) {
      const isMyTurn = currentGame.current_turn_player_id === me.id

      if (isMyTurn && !hand.has_folded && !hand.has_acted) {
        betControls.hidden = false
        gameMessage.textContent = 'Your turn! Bet, call, or fold.'

        const callBtn = betControls.querySelector('[data-action="call"]')
        if (currentGame.current_bet > 0 && hand.bet_amount < currentGame.current_bet) {
          const callAmount = currentGame.current_bet - hand.bet_amount
          callBtn.textContent = `Call (${callAmount})`
        } else {
          callBtn.textContent = 'Check'
        }
      } else if (hand.has_folded) {
        gameMessage.textContent = 'You folded this round.'
      } else {
        if (isAIGame && aiThinking) {
          gameMessage.textContent = `${aiPlayer.display_name} is thinking...`
        } else {
          const currentPlayer = gamePlayers.find(p => p.id === currentGame.current_turn_player_id)
          gameMessage.textContent = currentPlayer
            ? `Waiting for ${currentPlayer.display_name}...`
            : 'Waiting...'
        }
      }
    }

    function renderBluffControls(hand) {
      const bluffs = isAIGame ? localBluffs : gameBluffs
      const myBluff = bluffs.find(b => b.player_id === me.id)

      if (!hand.has_folded && !myBluff) {
        bluffControls.hidden = false
        gameMessage.textContent = 'Claim your hand strength. Bluff or be honest!'
      } else if (myBluff) {
        if (isAIGame && aiThinking) {
          gameMessage.textContent = `${aiPlayer.display_name} is deciding their claim...`
        } else {
          gameMessage.textContent = `You claimed: ${RANK_NAMES[myBluff.claim_rank] || 'Unknown'}. Waiting for others...`
        }
      } else {
        gameMessage.textContent = 'You folded. Watching the bluff phase...'
      }
    }

    function renderCallingControls(hand) {
      if (!hand.has_folded) {
        const bluffs = isAIGame ? localBluffs : gameBluffs
        const otherBluffs = bluffs.filter(b => b.player_id !== me.id && !b.called_by)

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

          // Add skip button
          const existing = callBluffControls.querySelector('.skip-reveal-btn')
          if (!existing) {
            const skipBtn = document.createElement('button')
            skipBtn.className = 'btn btn-ghost skip-reveal-btn'
            skipBtn.textContent = 'Skip to Reveal'
            skipBtn.style.marginTop = '12px'
            skipBtn.addEventListener('click', () => {
              if (isAIGame) {
                handleAISkipToReveal()
              } else {
                supabase.from(T_GAMES).update({ phase: 'reveal' })
                  .eq('game_id', currentGame.game_id)
              }
            })
            callBluffControls.appendChild(skipBtn)
          }

          // Attach call bluff listeners
          bluffClaims.querySelectorAll('.btn-callbluff').forEach(btn => {
            btn.addEventListener('click', () => {
              if (isAIGame) {
                handleAICallBluff(btn.dataset.bluffId)
              } else {
                callBluff(btn.dataset.bluffId, btn.dataset.target)
              }
            })
          })

          if (aiThinking) {
            gameMessage.textContent = `${aiPlayer.display_name} is deciding...`
          } else {
            gameMessage.textContent = "Call someone's bluff or skip to reveal!"
          }
        } else {
          gameMessage.textContent = 'No bluffs to call. Waiting for reveal...'
          // Auto-show skip
          if (!callBluffControls.querySelector('.skip-reveal-btn')) {
            callBluffControls.hidden = false
            bluffClaims.innerHTML = '<p style="color:var(--muted);font-size:0.9rem;">No outstanding bluffs to call.</p>'
            const skipBtn = document.createElement('button')
            skipBtn.className = 'btn btn-ghost skip-reveal-btn'
            skipBtn.textContent = 'Skip to Reveal'
            skipBtn.style.marginTop = '12px'
            skipBtn.addEventListener('click', () => {
              if (isAIGame) handleAISkipToReveal()
              else supabase.from(T_GAMES).update({ phase: 'reveal' }).eq('game_id', currentGame.game_id)
            })
            callBluffControls.appendChild(skipBtn)
          }
        }
      } else {
        gameMessage.textContent = 'You folded. Watching...'
      }
    }

    /* ========== BETTING ACTIONS (shared handler) ========== */
    betControls.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-bet')
      if (!btn || btn.disabled) return
      const action = btn.dataset.action
      const amount = parseInt(btn.dataset.amount) || 0

      if (isAIGame) {
        handleAIBet(action, amount)
        return
      }

      // Multiplayer betting
      try {
        betControls.querySelectorAll('.btn').forEach(b => b.disabled = true)

        if (action === 'fold') {
          await supabase.from(T_HANDS).update({ has_folded: true, has_acted: true })
            .eq('game_id', currentGame.game_id).eq('player_id', me.id)
          await logAction('fold', 0, `${me.display_name} folds`)
          SFX.fold()
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
          SFX.bet()
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
          SFX.bet()
        }

        await advanceTurn()
      } catch (err) {
        console.error('Bet action error:', err.message, err.stack)
      } finally {
        betControls.querySelectorAll('.btn').forEach(b => b.disabled = false)
      }
    })

    async function advanceTurn() {
      try {
        const { data: hands } = await supabase
          .from(T_HANDS).select('*').eq('game_id', currentGame.game_id)
        allHands = hands || []

        const activeHands = allHands.filter(h => !h.has_folded)

        if (activeHands.length <= 1) {
          await supabase.from(T_GAMES).update({ phase: 'reveal' })
            .eq('game_id', currentGame.game_id)
          return
        }

        const allActed = activeHands.every(h => h.has_acted)
        if (allActed) {
          await supabase.from(T_GAMES).update({ phase: 'bluffing' })
            .eq('game_id', currentGame.game_id)
          return
        }

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

        await supabase.from(T_GAMES).update({ phase: 'bluffing' })
          .eq('game_id', currentGame.game_id)
      } catch (err) {
        console.error('Advance turn error:', err.message)
      }
    }

    /* ========== BLUFF PHASE (shared handler) ========== */
    bluffControls.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-bluff')
      if (!btn) return
      const claimRank = parseInt(btn.dataset.rank)

      if (isAIGame) {
        handleAIBluff(claimRank)
        return
      }

      // Multiplayer
      try {
        bluffControls.querySelectorAll('.btn').forEach(b => b.disabled = true)
        SFX.bluff()

        await supabase.from(T_BLUFFS).insert({
          game_id: currentGame.game_id,
          player_id: me.id,
          player_name: me.display_name,
          claim_text: RANK_NAMES[claimRank],
          claim_rank: claimRank
        })

        await logAction('bluff', 0, `${me.display_name} claims ${RANK_NAMES[claimRank]}`)

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

    /* ========== CALL BLUFF (multiplayer only) ========== */
    async function callBluff(bluffId, targetPlayerId) {
      try {
        SFX.callBluff()
        const targetHand = allHands.find(h => h.player_id === targetPlayerId)
        const targetBluff = gameBluffs.find(b => b.id === bluffId)
        if (!targetHand || !targetBluff) return

        const actualRank = targetHand.hand_rank
        const claimedRank = targetBluff.claim_rank
        const isBluffCaught = actualRank < claimedRank

        await supabase.from(T_BLUFFS).update({
          called_by: me.id,
          result: isBluffCaught ? 'caught' : 'legit'
        }).eq('id', bluffId)

        const penalty = Math.min(currentGame.pot, 200)

        if (isBluffCaught) {
          const targetPlayer = gamePlayers.find(p => p.id === targetPlayerId)
          await supabase.from(T_PLAYERS).update({
            chips: Math.max(0, (targetPlayer?.chips || 500) - penalty)
          }).eq('id', targetPlayerId)

          await supabase.from(T_PLAYERS).update({
            chips: me.chips + penalty
          }).eq('id', me.id)

          await logAction('callbluff', penalty, `${me.display_name} caught ${targetBluff.player_name}'s bluff! Won ${penalty} chips.`)
        } else {
          await supabase.from(T_PLAYERS).update({
            chips: Math.max(0, me.chips - penalty)
          }).eq('id', me.id)

          const targetPlayer = gamePlayers.find(p => p.id === targetPlayerId)
          await supabase.from(T_PLAYERS).update({
            chips: (targetPlayer?.chips || 500) + penalty
          }).eq('id', targetPlayerId)

          await logAction('callbluff', penalty, `${me.display_name} called ${targetBluff.player_name}'s bluff but they were legit! Lost ${penalty} chips.`)
        }

        await supabase.from(T_GAMES).update({ phase: 'reveal' })
          .eq('game_id', currentGame.game_id)
      } catch (err) {
        console.error('Call bluff error:', err.message, err.stack)
      }
    }

    /* ========== RESULTS ========== */
    function showResults() {
      if (currentGame.phase === 'finished' && !resultsOverlay.hidden) return
      resultsOverlay.hidden = false

      const hands_ = isAIGame ? [localMyHand, localAIHand] : allHands
      const players_ = isAIGame ? [me, aiPlayer] : gamePlayers

      const activeHands = hands_.filter(h => !h.has_folded)
      const sorted = [...activeHands].sort((a, b) => {
        if (b.hand_rank !== a.hand_rank) return b.hand_rank - a.hand_rank
        const aMax = Math.max(...(a.cards || []).map(c => VAL_MAP[c.value] || 0))
        const bMax = Math.max(...(b.cards || []).map(c => VAL_MAP[c.value] || 0))
        return bMax - aMax
      })

      const winner = sorted[0]
      const winnerPlayer = players_.find(p => p.id === winner?.player_id)
      const isMe = winner?.player_id === me.id

      resultsTitle.textContent = isMe ? '🏆 You Win!' : `🏆 ${winnerPlayer?.display_name || 'Unknown'} Wins!`

      let html = `<p class="results-winnings">Pot: 🪙 ${currentGame.pot} chips</p>`

      sorted.forEach((h, i) => {
        const p = players_.find(pl => pl.id === h.player_id)
        const cards = (h.cards || []).map(c => `${c.value}${c.suit}`).join(' ')
        html += `
          <div class="results-player ${i === 0 ? 'winner' : ''}">
            <div class="rp-name">${i === 0 ? '👑 ' : ''}${escapeHtml(p?.display_name || 'Unknown')}</div>
            <div class="rp-hand">${h.hand_name}</div>
            <div class="rp-cards">${cards}</div>
          </div>
        `
      })

      const folded = hands_.filter(h => h.has_folded)
      folded.forEach(h => {
        const p = players_.find(pl => pl.id === h.player_id)
        html += `
          <div class="results-player">
            <div class="rp-name">${escapeHtml(p?.display_name || 'Unknown')}</div>
            <div class="rp-hand" style="color:var(--muted);">Folded</div>
          </div>
        `
      })

      resultsBody.innerHTML = html

      if (winner && currentGame.phase !== 'finished') {
        if (isAIGame) {
          finishAIGame(winner.player_id)
        } else {
          awardWinner(winner.player_id)
        }
      }
    }

    async function awardWinner(winnerId) {
      try {
        const winnerPlayer = gamePlayers.find(p => p.id === winnerId)
        if (!winnerPlayer) return

        const isMe = winnerId === me.id
        if (isMe) SFX.win()
        else SFX.lose()

        await supabase.from(T_PLAYERS).update({
          chips: winnerPlayer.chips + currentGame.pot,
          wins: (winnerPlayer.wins || 0) + 1,
          total_earnings: (winnerPlayer.total_earnings || 0) + currentGame.pot
        }).eq('id', winnerId)

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

    /* ========== NEXT ROUND / BACK TO LOBBY ========== */
    nextRoundBtn.addEventListener('click', async () => {
      try {
        SFX.click()
        resultsOverlay.hidden = true

        if (isAIGame) {
          // Start another AI game with same difficulty
          startAIGame(aiDifficulty)
          return
        }

        await supabase.from(T_PLAYERS).update({ current_game_id: null }).eq('id', me.id)
        me.current_game_id = null

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
        SFX.click()
        resultsOverlay.hidden = true
        isAIGame = false
        aiBadge.hidden = true

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

    /* ========== ACTION LOG (multiplayer) ========== */
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
      else if (action.action_type === 'bluff') colorClass = 'log-purple'
      entry.innerHTML = `<span class="${colorClass}">${msg}</span>`
      actionLog.prepend(entry)
    }

    /* ========== CLEANUP ========== */
    function cleanupSubscriptions() {
      subscriptions.forEach(s => {
        try { supabase.removeChannel(s) } catch (e) { /* ignore */ }
      })
      subscriptions = []
    }

    /* ========== HEARTBEAT ========== */
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

    /* ========== CLEANUP ON UNLOAD ========== */
    window.addEventListener('beforeunload', () => {
      if (me) {
        // Use sendBeacon for a last-ditch offline marker
        try {
          const url = `${SUPABASE_URL}/rest/v1/${T_PLAYERS}?id=eq.${me.id}`
          const headers = {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=minimal'
          }
          const body = JSON.stringify({ is_online: false, last_seen: new Date().toISOString() })
          const blob = new Blob([body], { type: 'application/json' })
          // sendBeacon only does POST, but Supabase PATCH needs different method
          // So we just accept this may not work perfectly
          navigator.sendBeacon && navigator.sendBeacon(url, blob)
        } catch (e) { /* ignore */ }
      }
    })

    /* ========== INIT ========== */
    async function init() {
      try {
        const autoLoggedIn = await tryAutoLogin()

        if (autoLoggedIn) {
          showView('lobby')
          startLobby()
        } else {
          showView('join')
        }
      } catch (err) {
        console.error('Init error:', err.message, err.stack)
        joinStatus.textContent = 'Error loading. Please refresh.'
      }
    }

    init()

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

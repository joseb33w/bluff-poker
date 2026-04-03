import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

;(async () => {
  try {
    /* ===== CONFIG ===== */
    const SUPABASE_URL = 'https://xhhmxabftbyxrirvvihn.supabase.co'
    const SUPABASE_KEY = 'sb_publishable_NZHoIxqqpSvVBP8MrLHCYA_gmg1AbN-'
    const P_TABLE = 'uNMexs7BYTXQ2_bluff_poker_players'
    const G_TABLE = 'uNMexs7BYTXQ2_bluff_poker_games'
    const H_TABLE = 'uNMexs7BYTXQ2_bluff_poker_hands'
    const A_TABLE = 'uNMexs7BYTXQ2_bluff_poker_actions'
    const B_TABLE = 'uNMexs7BYTXQ2_bluff_poker_bluffs'
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    /* ===== STORAGE KEYS ===== */
    const LS_PLAYER_ID = 'bluff_poker_player_id'
    const LS_NAME = 'bluff_poker_name'
    const LS_MUTED = 'bluff_poker_muted'
    const LS_GAME_ID = 'bluff_poker_current_game'

    /* ===== DOM ===== */
    const $ = id => document.getElementById(id)
    const joinScreen = $('joinScreen')
    const lobbyScreen = $('lobbyScreen')
    const gameScreen = $('gameScreen')
    const nameInput = $('nameInput')
    const joinBtn = $('joinBtn')
    const lobbyPlayers = $('lobbyPlayers')
    const lobbySub = $('lobbySub')
    const startGameBtn = $('startGameBtn')
    const aiGameBtn = $('aiGameBtn')
    const aiPicker = $('aiPicker')
    const aiPickerCancel = $('aiPickerCancel')
    const leaveBtn = $('leaveBtn')
    const muteBtn = $('muteBtn')
    const gameMuteBtn = $('gameMuteBtn')
    const gameLeaveBtn = $('gameLeaveBtn')
    const gamePhase = $('gamePhase')
    const gameRound = $('gameRound')
    const opponentsRow = $('opponentsRow')
    const potAmountEl = $('potAmount')
    const bluffZone = $('bluffZone')
    const playerCards = $('playerCards')
    const handLabel = $('handLabel')
    const foldBtn = $('foldBtn')
    const callBtn = $('callBtn')
    const callBtnLabel = $('callBtnLabel')
    const raiseBtn = $('raiseBtn')
    const bluffBtn = $('bluffBtn')
    const raiseSliderWrap = $('raiseSliderWrap')
    const raiseSlider = $('raiseSlider')
    const raiseValue = $('raiseValue')
    const raiseCancelBtn = $('raiseCancelBtn')
    const raiseConfirmBtn = $('raiseConfirmBtn')
    const playerChipsEl = $('playerChips')
    const playerNameTag = $('playerNameTag')
    const actionBar = $('actionBar')
    const actionLogInner = $('actionLogInner')
    const resultsOverlay = $('resultsOverlay')
    const resultsEmoji = $('resultsEmoji')
    const resultsTitle = $('resultsTitle')
    const resultsDetail = $('resultsDetail')
    const resultsHands = $('resultsHands')
    const resultsNextBtn = $('resultsNextBtn')
    const resultsLeaveBtn = $('resultsLeaveBtn')
    const leaderboardList = $('leaderboardList')
    const toastContainer = $('toastContainer')
    const confettiCanvas = $('confettiCanvas')
    const phaseBanner = $('phaseBanner')
    const phaseBannerText = $('phaseBannerText')

    /* ===== STATE ===== */
    let playerId = null
    let playerName = ''
    let currentGameId = null
    let isAiGame = false
    let aiDifficulty = 'medium'
    let aiPlayers = []
    let gameState = null
    let myHand = null
    let isMuted = localStorage.getItem(LS_MUTED) === 'true'
    let lobbyChannel = null
    let gameChannel = null
    let pendingRaise = 0
    let lastPhase = ''
    let previousChips = 0

    /* ===== AUDIO ===== */
    let audioCtx = null
    function ensureAudio() {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      if (audioCtx.state === 'suspended') audioCtx.resume()
    }
    function playSound(type) {
      if (isMuted) return
      try {
        ensureAudio()
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.connect(gain)
        gain.connect(audioCtx.destination)
        const now = audioCtx.currentTime
        switch (type) {
          case 'click':
            osc.frequency.setValueAtTime(800, now)
            gain.gain.setValueAtTime(0.15, now)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
            osc.start(now); osc.stop(now + 0.1)
            break
          case 'deal':
            osc.frequency.setValueAtTime(300, now)
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.15)
            gain.gain.setValueAtTime(0.12, now)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
            osc.start(now); osc.stop(now + 0.2)
            break
          case 'chips':
            osc.type = 'triangle'
            osc.frequency.setValueAtTime(1200, now)
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.2)
            gain.gain.setValueAtTime(0.1, now)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
            osc.start(now); osc.stop(now + 0.25)
            break
          case 'win':
            osc.type = 'sine'
            osc.frequency.setValueAtTime(523, now)
            osc.frequency.setValueAtTime(659, now + 0.15)
            osc.frequency.setValueAtTime(784, now + 0.3)
            gain.gain.setValueAtTime(0.15, now)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
            osc.start(now); osc.stop(now + 0.5)
            break
          case 'fold':
            osc.type = 'sawtooth'
            osc.frequency.setValueAtTime(400, now)
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.2)
            gain.gain.setValueAtTime(0.08, now)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
            osc.start(now); osc.stop(now + 0.25)
            break
          case 'bluff':
            osc.type = 'square'
            osc.frequency.setValueAtTime(200, now)
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.3)
            gain.gain.setValueAtTime(0.1, now)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
            osc.start(now); osc.stop(now + 0.35)
            break
          case 'turn':
            osc.type = 'sine'
            osc.frequency.setValueAtTime(600, now)
            osc.frequency.setValueAtTime(800, now + 0.1)
            gain.gain.setValueAtTime(0.12, now)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
            osc.start(now); osc.stop(now + 0.2)
            break
        }
      } catch (e) { /* audio error ok */ }
    }

    /* ===== TOAST SYSTEM ===== */
    function showToast(message, type = 'info', emoji = '', duration = 3000) {
      const toast = document.createElement('div')
      toast.className = `toast toast-${type}`
      toast.innerHTML = `${emoji ? `<span class="toast-emoji">${emoji}</span>` : ''}<span class="toast-text">${message}</span>`
      toastContainer.appendChild(toast)
      setTimeout(() => {
        toast.classList.add('removing')
        setTimeout(() => toast.remove(), 350)
      }, duration)
    }

    /* ===== CONFETTI ===== */
    const confettiCtx = confettiCanvas.getContext('2d')
    let confettiParticles = []
    let confettiRunning = false
    function resizeConfetti() {
      confettiCanvas.width = window.innerWidth
      confettiCanvas.height = window.innerHeight
    }
    window.addEventListener('resize', resizeConfetti)
    resizeConfetti()

    function launchConfetti(duration = 2500) {
      const colors = ['#f0c040','#22c55e','#ef4444','#3b82f6','#a855f7','#ec4899','#f97316']
      confettiParticles = []
      for (let i = 0; i < 120; i++) {
        confettiParticles.push({
          x: Math.random() * confettiCanvas.width,
          y: Math.random() * confettiCanvas.height - confettiCanvas.height,
          w: Math.random() * 8 + 4,
          h: Math.random() * 6 + 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          vx: (Math.random() - 0.5) * 4,
          vy: Math.random() * 3 + 2,
          rot: Math.random() * 360,
          rotV: (Math.random() - 0.5) * 10,
          opacity: 1
        })
      }
      confettiRunning = true
      const start = performance.now()
      function animate(time) {
        if (!confettiRunning) return
        const elapsed = time - start
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height)
        let alive = 0
        confettiParticles.forEach(p => {
          p.x += p.vx
          p.y += p.vy
          p.rot += p.rotV
          p.vy += 0.05
          if (elapsed > duration - 600) p.opacity = Math.max(0, p.opacity - 0.02)
          if (p.opacity <= 0 || p.y > confettiCanvas.height + 20) return
          alive++
          confettiCtx.save()
          confettiCtx.translate(p.x, p.y)
          confettiCtx.rotate(p.rot * Math.PI / 180)
          confettiCtx.globalAlpha = p.opacity
          confettiCtx.fillStyle = p.color
          confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
          confettiCtx.restore()
        })
        if (alive > 0 && elapsed < duration + 800) {
          requestAnimationFrame(animate)
        } else {
          confettiRunning = false
          confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height)
        }
      }
      requestAnimationFrame(animate)
    }

    /* ===== PHASE BANNER ===== */
    function showPhaseBanner(text) {
      phaseBanner.classList.remove('show')
      phaseBannerText.textContent = text
      void phaseBanner.offsetWidth
      phaseBanner.classList.add('show')
      setTimeout(() => phaseBanner.classList.remove('show'), 2000)
    }

    /* ===== ANIMATED CHIP COUNT ===== */
    function animateChipCount(el, from, to, duration = 600) {
      const start = performance.now()
      const diff = to - from
      if (diff === 0) return
      el.classList.add('counting')
      function step(time) {
        const elapsed = time - start
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        el.textContent = Math.round(from + diff * eased).toLocaleString()
        if (progress < 1) requestAnimationFrame(step)
        else {
          el.textContent = to.toLocaleString()
          setTimeout(() => el.classList.remove('counting'), 350)
        }
      }
      requestAnimationFrame(step)
    }

    /* ===== MUTE ===== */
    function updateMuteUI() {
      const btns = [muteBtn, gameMuteBtn]
      btns.forEach(b => {
        if (isMuted) b.classList.add('muted')
        else b.classList.remove('muted')
      })
      localStorage.setItem(LS_MUTED, isMuted)
    }
    updateMuteUI()
    muteBtn.addEventListener('click', () => { isMuted = !isMuted; updateMuteUI(); playSound('click') })
    gameMuteBtn.addEventListener('click', () => { isMuted = !isMuted; updateMuteUI(); playSound('click') })

    /* ===== SCREEN NAV ===== */
    function showScreen(name) {
      const screens = { join: joinScreen, lobby: lobbyScreen, game: gameScreen }
      Object.entries(screens).forEach(([key, el]) => {
        if (key === name) {
          el.classList.remove('exit-up', 'exit-down')
          el.classList.add('active')
        } else {
          if (el.classList.contains('active')) {
            el.classList.remove('active')
            el.classList.add('exit-up')
          }
        }
      })
    }

    /* ===== DECK ===== */
    const SUITS = ['♠','♥','♦','♣']
    const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
    function newDeck() {
      const d = []
      for (const s of SUITS) for (const r of RANKS) d.push({ suit: s, rank: r })
      return d
    }
    function shuffleDeck(deck) {
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[deck[i], deck[j]] = [deck[j], deck[i]]
      }
      return deck
    }
    function cardColor(suit) { return (suit === '♥' || suit === '♦') ? 'card-red' : 'card-black' }

    /* ===== HAND EVAL ===== */
    const RANK_VALUES = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 }
    function evaluateHand(cards) {
      if (!cards || cards.length < 2) return { rank: 0, name: 'No Hand', score: 0 }
      const sorted = [...cards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank])
      const ranks = sorted.map(c => RANK_VALUES[c.rank])
      const suits = sorted.map(c => c.suit)
      const rankCounts = {}
      ranks.forEach(r => { rankCounts[r] = (rankCounts[r] || 0) + 1 })
      const counts = Object.values(rankCounts).sort((a, b) => b - a)
      const uniqueRanks = Object.keys(rankCounts).map(Number).sort((a, b) => b - a)
      const isFlush = cards.length >= 5 && new Set(suits).size === 1
      let isStraight = false
      if (uniqueRanks.length >= 5) {
        for (let i = 0; i <= uniqueRanks.length - 5; i++) {
          if (uniqueRanks[i] - uniqueRanks[i + 4] === 4) { isStraight = true; break }
        }
        if (!isStraight && uniqueRanks.includes(14)) {
          const low = uniqueRanks.filter(r => r <= 5)
          if (low.length >= 4 && low[0] === 5 && low[low.length - 1] === 2) isStraight = true
        }
      }
      let rank, name, score
      if (isFlush && isStraight && uniqueRanks[0] === 14) { rank = 9; name = 'Royal Flush'; score = 9000 }
      else if (isFlush && isStraight) { rank = 8; name = 'Straight Flush'; score = 8000 + uniqueRanks[0] }
      else if (counts[0] === 4) { rank = 7; name = 'Four of a Kind'; score = 7000 + maxRankWithCount(rankCounts, 4) }
      else if (counts[0] === 3 && counts[1] >= 2) { rank = 6; name = 'Full House'; score = 6000 + maxRankWithCount(rankCounts, 3) * 15 + maxRankWithCount(rankCounts, 2) }
      else if (isFlush) { rank = 5; name = 'Flush'; score = 5000 + uniqueRanks[0] }
      else if (isStraight) { rank = 4; name = 'Straight'; score = 4000 + uniqueRanks[0] }
      else if (counts[0] === 3) { rank = 3; name = 'Three of a Kind'; score = 3000 + maxRankWithCount(rankCounts, 3) }
      else if (counts[0] === 2 && counts[1] === 2) { rank = 2; name = 'Two Pair'; score = 2000 + uniqueRanks[0] }
      else if (counts[0] === 2) { rank = 1; name = 'One Pair'; score = 1000 + maxRankWithCount(rankCounts, 2) }
      else { rank = 0; name = 'High Card'; score = uniqueRanks[0] }
      return { rank, name, score }
      function maxRankWithCount(rc, c) {
        return Math.max(...Object.entries(rc).filter(([, v]) => v === c).map(([k]) => Number(k)))
      }
    }

    /* ===== JOIN ===== */
    nameInput.addEventListener('input', () => {
      joinBtn.disabled = nameInput.value.trim().length < 2
    })

    joinBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim()
      if (name.length < 2) return
      playSound('click')
      joinBtn.disabled = true
      joinBtn.querySelector('span').textContent = 'Joining…'
      try {
        const sessionId = crypto.randomUUID()
        const { data, error } = await supabase.from(P_TABLE).insert({
          display_name: name, chips: 1000, session_id: sessionId,
          is_online: true, wins: 0, losses: 0, total_earnings: 0
        }).select().single()
        if (error) throw error
        playerId = data.id
        playerName = name
        localStorage.setItem(LS_PLAYER_ID, playerId)
        localStorage.setItem(LS_NAME, name)
        showScreen('lobby')
        showToast(`Welcome, ${name}! 🎰`, 'success', '🃏')
        initLobby()
      } catch (err) {
        console.error('Join error:', err)
        showToast('Failed to join. Try again.', 'error', '❌')
        joinBtn.disabled = false
        joinBtn.querySelector('span').textContent = 'Join the Table'
      }
    })

    /* ===== AUTO-LOGIN ===== */
    async function tryAutoLogin() {
      const savedId = localStorage.getItem(LS_PLAYER_ID)
      const savedName = localStorage.getItem(LS_NAME)
      if (!savedId || !savedName) return false
      try {
        const { data, error } = await supabase.from(P_TABLE)
          .select('*').eq('id', savedId).single()
        if (error || !data) {
          localStorage.removeItem(LS_PLAYER_ID)
          localStorage.removeItem(LS_NAME)
          localStorage.removeItem(LS_GAME_ID)
          return false
        }
        await supabase.from(P_TABLE).update({
          is_online: true, last_seen: new Date().toISOString()
        }).eq('id', savedId)
        playerId = savedId
        playerName = savedName
        nameInput.value = savedName

        /* Check if was in a game */
        const savedGameId = localStorage.getItem(LS_GAME_ID)
        if (savedGameId && data.current_game_id) {
          const { data: gData } = await supabase.from(G_TABLE)
            .select('*').eq('id', savedGameId).single()
          if (gData && (gData.status === 'playing' || gData.status === 'waiting')) {
            currentGameId = savedGameId
            showScreen('game')
            showToast('Reconnected to your game!', 'info', '🔄')
            initGameSubscriptions()
            await refreshGameState()
            return true
          }
        }

        showScreen('lobby')
        showToast(`Welcome back, ${savedName}!`, 'success', '👋')
        initLobby()
        return true
      } catch (e) {
        console.warn('Auto-login failed:', e.message)
        return false
      }
    }

    /* ===== LOBBY ===== */
    async function initLobby() {
      playerNameTag.textContent = playerName
      await loadLeaderboard()
      await loadLobbyPlayers()

      if (lobbyChannel) supabase.removeChannel(lobbyChannel)
      lobbyChannel = supabase.channel('lobby-players')
        .on('postgres_changes', { event: '*', schema: 'public', table: P_TABLE }, () => {
          loadLobbyPlayers()
          loadLeaderboard()
        })
        .subscribe()
    }

    async function loadLobbyPlayers() {
      try {
        const { data } = await supabase.from(P_TABLE)
          .select('*').eq('is_online', true)
          .order('chips', { ascending: false }).limit(20)
        if (!data) return
        lobbyPlayers.innerHTML = ''
        data.forEach((p, i) => {
          const isMe = p.id === playerId
          const card = document.createElement('div')
          card.className = 'lobby-player-card'
          card.style.animationDelay = `${i * 0.07}s`
          card.innerHTML = `
            <div class="lobby-player-avatar">${p.display_name.charAt(0).toUpperCase()}</div>
            <div class="lobby-player-info">
              <div class="lobby-player-name">${esc(p.display_name)}${isMe ? ' (You)' : ''}</div>
              <div class="lobby-player-stat">🪙 ${p.chips.toLocaleString()} · W${p.wins} / L${p.losses}</div>
            </div>
            <span class="lobby-player-badge online">Online</span>
          `
          lobbyPlayers.appendChild(card)
        })
        lobbySub.textContent = `${data.length} player${data.length !== 1 ? 's' : ''} online`
        startGameBtn.disabled = data.length < 2
      } catch (e) { console.warn('Lobby load error:', e.message) }
    }

    async function loadLeaderboard() {
      try {
        const { data } = await supabase.from(P_TABLE)
          .select('display_name, chips, wins')
          .order('chips', { ascending: false }).limit(10)
        if (!data) return
        leaderboardList.innerHTML = data.map((p, i) => {
          const rankClass = i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : ''
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`
          return `<div class="lb-row"><span class="lb-rank ${rankClass}">${medal}</span><span class="lb-name">${esc(p.display_name)}</span><span class="lb-chips">🪙 ${p.chips.toLocaleString()}</span></div>`
        }).join('')
      } catch (e) { /* ok */ }
    }

    /* ===== LEAVE LOBBY ===== */
    leaveBtn.addEventListener('click', async () => {
      playSound('click')
      if (lobbyChannel) { supabase.removeChannel(lobbyChannel); lobbyChannel = null }
      await supabase.from(P_TABLE).update({ is_online: false }).eq('id', playerId)
      localStorage.removeItem(LS_PLAYER_ID)
      localStorage.removeItem(LS_NAME)
      localStorage.removeItem(LS_GAME_ID)
      playerId = null
      playerName = ''
      nameInput.value = ''
      showScreen('join')
      showToast('Left the lobby', 'info', '👋')
    })

    /* ===== START MULTIPLAYER ===== */
    startGameBtn.addEventListener('click', async () => {
      playSound('click')
      startGameBtn.disabled = true
      try {
        const { data: onlinePlayers } = await supabase.from(P_TABLE)
          .select('id').eq('is_online', true).limit(6)
        if (!onlinePlayers || onlinePlayers.length < 2) {
          showToast('Need at least 2 players!', 'warning', '⚠️')
          startGameBtn.disabled = false
          return
        }
        const gameId = crypto.randomUUID()
        const turnOrder = onlinePlayers.map(p => p.id)
        const { error: gErr } = await supabase.from(G_TABLE).insert({
          game_id: gameId, status: 'playing', phase: 'deal', pot: 0,
          current_bet: 0, current_turn_player_id: turnOrder[0],
          turn_order: turnOrder, turn_index: 0, round_number: 1, created_by: playerId
        })
        if (gErr) throw gErr

        for (const p of onlinePlayers) {
          await supabase.from(P_TABLE).update({ current_game_id: gameId }).eq('id', p.id)
        }

        currentGameId = gameId
        isAiGame = false
        localStorage.setItem(LS_GAME_ID, gameId)
        showScreen('game')
        showToast('Game started!', 'success', '🎰')
        initGameSubscriptions()
        await dealNewRound(gameId, turnOrder)
      } catch (e) {
        console.error('Start game error:', e)
        showToast('Failed to start game', 'error', '❌')
        startGameBtn.disabled = false
      }
    })

    /* ===== AI GAME ===== */
    aiGameBtn.addEventListener('click', () => {
      playSound('click')
      aiPicker.classList.remove('hidden')
    })
    aiPickerCancel.addEventListener('click', () => {
      playSound('click')
      aiPicker.classList.add('hidden')
    })
    document.querySelectorAll('.ai-diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        playSound('click')
        aiDifficulty = btn.dataset.diff
        aiPicker.classList.add('hidden')
        startAiGame()
      })
    })

    async function startAiGame() {
      isAiGame = true
      const aiNames = {
        easy: ['Timid Tim', 'Gentle Gina', 'Cautious Carl'],
        medium: ['Steady Steve', 'Balanced Beth', 'Normal Nick'],
        hard: ['Shark', 'Viper', 'Ice Queen'],
        chaos: ['Wildcard Willy', 'Chaos Karen', 'YOLO Pete']
      }
      const names = aiNames[aiDifficulty] || aiNames.medium
      const numAI = Math.min(names.length, 3)
      aiPlayers = []
      for (let i = 0; i < numAI; i++) {
        aiPlayers.push({
          id: `ai-${i}`,
          display_name: names[i],
          chips: 1000,
          is_ai: true,
          has_folded: false,
          bet_amount: 0,
          cards: [],
          hand_rank: 0,
          hand_name: '',
          has_acted: false
        })
      }

      const gameId = `ai-${crypto.randomUUID()}`
      currentGameId = gameId
      localStorage.setItem(LS_GAME_ID, gameId)
      const turnOrder = [playerId, ...aiPlayers.map(a => a.id)]

      gameState = {
        game_id: gameId, status: 'playing', phase: 'deal', pot: 0,
        current_bet: 0, current_turn_player_id: playerId,
        turn_order: turnOrder, turn_index: 0, round_number: 1
      }

      showScreen('game')
      showToast(`AI Game: ${aiDifficulty.toUpperCase()} mode`, 'info', '🤖')
      await dealAiRound()
    }

    /* ===== DEAL ===== */
    async function dealNewRound(gameId, turnOrder) {
      const deck = shuffleDeck(newDeck())
      let ci = 0
      for (const pid of turnOrder) {
        const cards = [deck[ci++], deck[ci++], deck[ci++], deck[ci++], deck[ci++]]
        const eval_ = evaluateHand(cards)
        await supabase.from(H_TABLE).insert({
          game_id: gameId, player_id: pid, cards,
          hand_rank: eval_.rank, hand_name: eval_.name,
          has_folded: false, bet_amount: 0, has_acted: false
        })
      }
      await supabase.from(G_TABLE).update({ phase: 'betting', current_bet: 0, turn_index: 0, current_turn_player_id: turnOrder[0] }).eq('game_id', gameId)
      await refreshGameState()
    }

    async function dealAiRound() {
      const deck = shuffleDeck(newDeck())
      let ci = 0
      const myCards = [deck[ci++], deck[ci++], deck[ci++], deck[ci++], deck[ci++]]
      const eval_ = evaluateHand(myCards)
      myHand = { cards: myCards, hand_rank: eval_.rank, hand_name: eval_.name, has_folded: false, bet_amount: 0, has_acted: false }

      for (const ai of aiPlayers) {
        ai.cards = [deck[ci++], deck[ci++], deck[ci++], deck[ci++], deck[ci++]]
        const ae = evaluateHand(ai.cards)
        ai.hand_rank = ae.rank
        ai.hand_name = ae.name
        ai.has_folded = false
        ai.bet_amount = 0
        ai.has_acted = false
      }

      gameState.phase = 'betting'
      gameState.current_bet = 0
      gameState.turn_index = 0
      gameState.current_turn_player_id = playerId
      gameState.pot = 0
      previousChips = 0

      playSound('deal')
      showPhaseBanner('DEAL')
      renderAiGame()
    }

    /* ===== GAME SUBSCRIPTIONS (MULTIPLAYER) ===== */
    function initGameSubscriptions() {
      if (gameChannel) supabase.removeChannel(gameChannel)
      gameChannel = supabase.channel(`game-${currentGameId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: G_TABLE, filter: `game_id=eq.${currentGameId}` }, () => refreshGameState())
        .on('postgres_changes', { event: '*', schema: 'public', table: H_TABLE, filter: `game_id=eq.${currentGameId}` }, () => refreshGameState())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: A_TABLE, filter: `game_id=eq.${currentGameId}` }, (payload) => {
          const a = payload.new
          addLogEntry(a.player_name, a.action_type, a.amount, a.message)
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: B_TABLE, filter: `game_id=eq.${currentGameId}` }, (payload) => {
          const b = payload.new
          renderBluffClaim(b)
        })
        .subscribe()
    }

    async function refreshGameState() {
      if (isAiGame) { renderAiGame(); return }
      try {
        const { data: gData } = await supabase.from(G_TABLE)
          .select('*').eq('game_id', currentGameId).single()
        if (!gData) return
        gameState = gData

        const { data: hands } = await supabase.from(H_TABLE)
          .select('*').eq('game_id', currentGameId)
        if (!hands) return

        const myH = hands.find(h => h.player_id === playerId)
        myHand = myH

        if (gData.phase !== lastPhase && gData.phase !== 'deal') {
          showPhaseBanner(gData.phase.toUpperCase())
          lastPhase = gData.phase
        }

        renderMultiplayerGame(gData, hands)
      } catch (e) { console.warn('Refresh error:', e.message) }
    }

    /* ===== RENDER MULTIPLAYER ===== */
    function renderMultiplayerGame(gs, hands) {
      gamePhase.textContent = gs.phase.toUpperCase()
      gameRound.textContent = `Round ${gs.round_number}`

      const oldPot = parseInt(potAmountEl.textContent.replace(/,/g, '')) || 0
      if (oldPot !== gs.pot) {
        animateChipCount(potAmountEl, oldPot, gs.pot)
        if (gs.pot > oldPot) potAmountEl.classList.add('bump')
        setTimeout(() => potAmountEl.classList.remove('bump'), 400)
      }

      // Opponents
      opponentsRow.innerHTML = ''
      hands.filter(h => h.player_id !== playerId).forEach(h => {
        const isActive = gs.current_turn_player_id === h.player_id
        const card = document.createElement('div')
        card.className = `opponent-card${isActive ? ' active-turn' : ''}${h.has_folded ? ' folded' : ''}`
        const showCards = gs.phase === 'showdown' || gs.status === 'finished'
        const cardsHtml = (h.cards || []).map(c => {
          if (showCards) return `<div class="opp-card-mini revealed ${cardColor(c.suit)}">${c.rank}${c.suit}</div>`
          return `<div class="opp-card-mini">🂠</div>`
        }).join('')
        card.innerHTML = `
          <div class="opp-name">${esc(h.player_id.substring(0, 8))}</div>
          <div class="opp-chips">🪙 ${h.bet_amount || 0}</div>
          <div class="opp-cards">${cardsHtml}</div>
          ${h.has_folded ? '<div class="opp-status">Folded</div>' : ''}
          ${h.bet_amount > 0 ? `<div class="opp-bet-badge">${h.bet_amount}</div>` : ''}
        `
        opponentsRow.appendChild(card)
      })

      // My cards
      renderMyCards(myHand)

      // My chips
      if (myHand) {
        const { data: pData } = {} // would need player data
        playerChipsEl.textContent = '1000' // placeholder for multiplayer
      }

      // Actions
      const isMyTurn = gs.current_turn_player_id === playerId && !myHand?.has_folded
      toggleActions(isMyTurn, gs)
      if (isMyTurn) {
        playSound('turn')
        showToast("It's your turn!", 'warning', '🎯', 2000)
      }
    }

    /* ===== RENDER AI GAME ===== */
    function renderAiGame() {
      if (!gameState) return
      gamePhase.textContent = gameState.phase.toUpperCase()
      gameRound.textContent = `Round ${gameState.round_number}`

      const oldPot = parseInt(potAmountEl.textContent.replace(/,/g, '')) || 0
      if (oldPot !== gameState.pot) {
        animateChipCount(potAmountEl, oldPot, gameState.pot)
        if (gameState.pot > oldPot) { potAmountEl.classList.add('bump'); playSound('chips') }
        setTimeout(() => potAmountEl.classList.remove('bump'), 400)
      }

      // Opponents
      opponentsRow.innerHTML = ''
      aiPlayers.forEach(ai => {
        const isActive = gameState.current_turn_player_id === ai.id
        const card = document.createElement('div')
        card.className = `opponent-card${isActive ? ' active-turn' : ''}${ai.has_folded ? ' folded' : ''}`
        const showCards = gameState.phase === 'showdown'
        const cardsHtml = ai.cards.map(c => {
          if (showCards) return `<div class="opp-card-mini revealed ${cardColor(c.suit)}">${c.rank}${c.suit}</div>`
          return `<div class="opp-card-mini">🂠</div>`
        }).join('')
        card.innerHTML = `
          <div class="opp-name">${esc(ai.display_name)}</div>
          <div class="opp-chips">🪙 ${ai.chips.toLocaleString()}</div>
          <div class="opp-cards">${cardsHtml}</div>
          ${ai.has_folded ? '<div class="opp-status">Folded</div>' : ''}
          ${ai.bet_amount > 0 ? `<div class="opp-bet-badge">${ai.bet_amount}</div>` : ''}
        `
        opponentsRow.appendChild(card)
      })

      // My cards
      renderMyCards(myHand)

      // My chips
      const { data: pData } = {}
      const myChips = myHand ? 1000 - (myHand.bet_amount || 0) + previousChips : 1000
      const currentChips = parseInt(playerChipsEl.textContent.replace(/,/g, '')) || 0
      if (currentChips !== myChips) animateChipCount(playerChipsEl, currentChips, myChips)
      playerNameTag.textContent = playerName

      // Actions
      const isMyTurn = gameState.current_turn_player_id === playerId && !myHand?.has_folded && gameState.phase === 'betting'
      toggleActions(isMyTurn, gameState)
    }

    function renderMyCards(hand) {
      playerCards.innerHTML = ''
      handLabel.textContent = ''
      if (!hand || !hand.cards) return
      hand.cards.forEach(c => {
        const el = document.createElement('div')
        el.className = `player-card ${cardColor(c.suit)}`
        el.innerHTML = `<span class="card-rank">${c.rank}</span><span class="card-suit">${c.suit}</span>`
        playerCards.appendChild(el)
      })
      if (hand.hand_name) {
        handLabel.textContent = `✨ ${hand.hand_name}`
      }
      playSound('deal')
    }

    function toggleActions(enabled, gs) {
      foldBtn.disabled = !enabled
      callBtn.disabled = !enabled
      raiseBtn.disabled = !enabled
      bluffBtn.disabled = !enabled
      if (enabled) {
        actionBar.querySelectorAll('.action-btn').forEach(b => b.classList.add('my-turn'))
        callBtnLabel.textContent = gs.current_bet > 0 ? `Call ${gs.current_bet}` : 'Check'
      } else {
        actionBar.querySelectorAll('.action-btn').forEach(b => b.classList.remove('my-turn'))
      }
    }

    /* ===== PLAYER ACTIONS ===== */
    foldBtn.addEventListener('click', () => doAction('fold'))
    callBtn.addEventListener('click', () => doAction('call'))
    raiseBtn.addEventListener('click', () => {
      playSound('click')
      raiseSliderWrap.classList.remove('hidden')
      raiseSlider.min = (gameState.current_bet || 0) + 10
      raiseSlider.max = 500
      raiseSlider.value = raiseSlider.min
      raiseValue.textContent = raiseSlider.value
    })
    raiseSlider.addEventListener('input', () => {
      raiseValue.textContent = raiseSlider.value
    })
    raiseCancelBtn.addEventListener('click', () => {
      playSound('click')
      raiseSliderWrap.classList.add('hidden')
    })
    raiseConfirmBtn.addEventListener('click', () => {
      pendingRaise = parseInt(raiseSlider.value)
      raiseSliderWrap.classList.add('hidden')
      doAction('raise', pendingRaise)
    })
    bluffBtn.addEventListener('click', () => doAction('bluff'))

    async function doAction(type, amount = 0) {
      playSound(type === 'fold' ? 'fold' : type === 'bluff' ? 'bluff' : 'chips')

      if (isAiGame) {
        handleAiGameAction(type, amount)
        return
      }

      // Multiplayer action
      try {
        const actionData = {
          game_id: currentGameId, player_id: playerId, player_name: playerName,
          action_type: type, amount, phase: gameState.phase
        }
        if (type === 'bluff') {
          const bluffClaim = generateBluffClaim(myHand)
          actionData.message = bluffClaim.text
          await supabase.from(B_TABLE).insert({
            game_id: currentGameId, player_id: playerId, player_name: playerName,
            claim_text: bluffClaim.text, claim_rank: bluffClaim.rank
          })
        }
        await supabase.from(A_TABLE).insert(actionData)
        if (type === 'fold') {
          await supabase.from(H_TABLE).update({ has_folded: true }).eq('game_id', currentGameId).eq('player_id', playerId)
        } else if (type === 'call') {
          const callAmt = gameState.current_bet || 0
          await supabase.from(H_TABLE).update({ bet_amount: callAmt, has_acted: true }).eq('game_id', currentGameId).eq('player_id', playerId)
          await supabase.from(G_TABLE).update({ pot: (gameState.pot || 0) + callAmt }).eq('game_id', currentGameId)
        } else if (type === 'raise') {
          await supabase.from(H_TABLE).update({ bet_amount: amount, has_acted: true }).eq('game_id', currentGameId).eq('player_id', playerId)
          await supabase.from(G_TABLE).update({ pot: (gameState.pot || 0) + amount, current_bet: amount }).eq('game_id', currentGameId)
        }
        await advanceTurn()
      } catch (e) {
        console.error('Action error:', e)
        showToast('Action failed', 'error', '❌')
      }
    }

    async function advanceTurn() {
      if (isAiGame) return
      const to = gameState.turn_order
      let nextIdx = (gameState.turn_index + 1) % to.length
      // Skip folded
      let attempts = 0
      while (attempts < to.length) {
        const { data: h } = await supabase.from(H_TABLE)
          .select('has_folded').eq('game_id', currentGameId).eq('player_id', to[nextIdx]).single()
        if (h && !h.has_folded) break
        nextIdx = (nextIdx + 1) % to.length
        attempts++
      }

      // Check if round should end
      const { data: allHands } = await supabase.from(H_TABLE)
        .select('*').eq('game_id', currentGameId)
      const activePlayers = allHands.filter(h => !h.has_folded)
      const allActed = activePlayers.every(h => h.has_acted)

      if (activePlayers.length === 1) {
        await endRound(activePlayers[0].player_id, 'last_standing')
        return
      }
      if (allActed) {
        await goToShowdown()
        return
      }

      await supabase.from(G_TABLE).update({
        turn_index: nextIdx, current_turn_player_id: to[nextIdx]
      }).eq('game_id', currentGameId)
    }

    async function goToShowdown() {
      await supabase.from(G_TABLE).update({ phase: 'showdown' }).eq('game_id', currentGameId)
      setTimeout(async () => {
        const { data: allHands } = await supabase.from(H_TABLE)
          .select('*').eq('game_id', currentGameId)
        const active = allHands.filter(h => !h.has_folded)
        const best = active.reduce((best, h) => {
          const score = evaluateHand(h.cards).score
          return score > best.score ? { ...h, score } : best
        }, { score: -1 })
        await endRound(best.player_id, 'showdown')
      }, 2000)
    }

    async function endRound(winnerId, reason) {
      const pot = gameState.pot || 0
      await supabase.from(G_TABLE).update({ status: 'finished', winner_id: winnerId, phase: 'finished' }).eq('game_id', currentGameId)

      const isMe = winnerId === playerId
      if (isMe) {
        playSound('win')
        launchConfetti(3000)
        showToast(`You won ${pot} chips! 💰`, 'success', '🏆', 4000)
      } else {
        showToast('You lost this round', 'info', '😔', 3000)
      }

      showResults(winnerId, pot, reason)
    }

    function showResults(winnerId, pot, reason) {
      resultsOverlay.classList.remove('hidden')
      const isMe = winnerId === playerId
      resultsEmoji.textContent = isMe ? '🏆' : '😞'
      resultsTitle.textContent = isMe ? 'You Win!' : 'You Lost'
      resultsDetail.textContent = isMe ? `You won ${pot} chips!` : `Better luck next time!`

      if (isMe) {
        potAmountEl.classList.add('pot-win')
        setTimeout(() => potAmountEl.classList.remove('pot-win'), 800)
      }
    }

    resultsNextBtn.addEventListener('click', async () => {
      playSound('click')
      resultsOverlay.classList.add('hidden')
      if (isAiGame) {
        gameState.round_number++
        await dealAiRound()
      } else {
        // New round multiplayer
        const turnOrder = gameState.turn_order
        const newGameId = crypto.randomUUID()
        currentGameId = newGameId
        localStorage.setItem(LS_GAME_ID, newGameId)
        gameState.pot = 0
        gameState.current_bet = 0
        gameState.round_number++
        actionLogInner.innerHTML = ''

        await supabase.from(G_TABLE).insert({
          game_id: newGameId, status: 'playing', phase: 'deal', pot: 0,
          current_bet: 0, current_turn_player_id: turnOrder[0],
          turn_order: turnOrder, turn_index: 0, round_number: gameState.round_number, created_by: playerId
        })
        initGameSubscriptions()
        await dealNewRound(newGameId, turnOrder)
      }
    })

    resultsLeaveBtn.addEventListener('click', () => {
      playSound('click')
      leaveGame()
    })

    gameLeaveBtn.addEventListener('click', () => {
      playSound('click')
      leaveGame()
    })

    async function leaveGame() {
      resultsOverlay.classList.add('hidden')
      if (gameChannel) { supabase.removeChannel(gameChannel); gameChannel = null }
      currentGameId = null
      isAiGame = false
      aiPlayers = []
      gameState = null
      myHand = null
      localStorage.removeItem(LS_GAME_ID)
      actionLogInner.innerHTML = ''
      showScreen('lobby')
      showToast('Back to lobby', 'info', '🏠')
      await initLobby()
    }

    /* ===== AI GAME LOGIC ===== */
    function handleAiGameAction(type, amount) {
      if (type === 'fold') {
        myHand.has_folded = true
        addLogEntry(playerName, 'fold', 0)
        showToast('You folded', 'info', '🏳️')
        // AI wins
        const winner = aiPlayers.find(a => !a.has_folded) || aiPlayers[0]
        endAiRound(winner.id, 'player_folded')
        return
      }

      if (type === 'call') {
        const callAmt = gameState.current_bet || 0
        myHand.bet_amount = callAmt
        gameState.pot += callAmt
        myHand.has_acted = true
        addLogEntry(playerName, callAmt > 0 ? 'call' : 'check', callAmt)
        showToast(callAmt > 0 ? `Called ${callAmt}` : 'Checked', 'info', '✅', 2000)
      } else if (type === 'raise') {
        myHand.bet_amount = amount
        gameState.pot += amount
        gameState.current_bet = amount
        myHand.has_acted = true
        addLogEntry(playerName, 'raise', amount)
        showToast(`Raised to ${amount}`, 'info', '🔥', 2000)
      } else if (type === 'bluff') {
        const claim = generateBluffClaim(myHand)
        myHand.has_acted = true
        addLogEntry(playerName, 'bluff', 0, claim.text)
        showToast(`Bluffed: ${claim.text}`, 'bluff', '🎭', 3000)
        renderBluffClaim({ player_name: playerName, claim_text: claim.text })
      }

      renderAiGame()

      // AI turns
      setTimeout(() => runAiTurns(), 800)
    }

    function runAiTurns() {
      let delay = 0
      for (const ai of aiPlayers) {
        if (ai.has_folded) continue
        delay += 900
        setTimeout(() => {
          const action = decideAiAction(ai)
          gameState.current_turn_player_id = ai.id
          renderAiGame()

          if (action.type === 'fold') {
            ai.has_folded = true
            addLogEntry(ai.display_name, 'fold', 0)
            showToast(`${ai.display_name} folded`, 'info', '🏳️', 2000)
          } else if (action.type === 'call') {
            const callAmt = gameState.current_bet || 0
            ai.bet_amount = callAmt
            gameState.pot += callAmt
            ai.has_acted = true
            addLogEntry(ai.display_name, callAmt > 0 ? 'call' : 'check', callAmt)
          } else if (action.type === 'raise') {
            ai.bet_amount = action.amount
            gameState.pot += action.amount
            gameState.current_bet = action.amount
            ai.has_acted = true
            addLogEntry(ai.display_name, 'raise', action.amount)
            showToast(`${ai.display_name} raised to ${action.amount}!`, 'warning', '🔥', 2000)
          } else if (action.type === 'bluff') {
            const claim = generateBluffClaim(ai)
            ai.has_acted = true
            addLogEntry(ai.display_name, 'bluff', 0, claim.text)
            showToast(`${ai.display_name} bluffs!`, 'bluff', '🎭', 2500)
            renderBluffClaim({ player_name: ai.display_name, claim_text: claim.text })
          }
          playSound(action.type === 'fold' ? 'fold' : 'chips')
          renderAiGame()
        }, delay)
      }

      // After all AI acted, check round end
      setTimeout(() => {
        const activePlayers = aiPlayers.filter(a => !a.has_folded)
        if (activePlayers.length === 0) {
          endAiRound(playerId, 'all_ai_folded')
          return
        }

        if (myHand.has_folded) {
          endAiRound(activePlayers[0].id, 'player_folded')
          return
        }

        // Go to showdown
        gameState.phase = 'showdown'
        showPhaseBanner('SHOWDOWN')
        renderAiGame()

        setTimeout(() => {
          // Determine winner
          let bestScore = evaluateHand(myHand.cards).score
          let winnerId = playerId
          let winnerName = playerName

          for (const ai of aiPlayers) {
            if (ai.has_folded) continue
            const score = evaluateHand(ai.cards).score
            if (score > bestScore) {
              bestScore = score
              winnerId = ai.id
              winnerName = ai.display_name
            }
          }

          endAiRound(winnerId, 'showdown')
        }, 2000)
      }, delay + 600)
    }

    function endAiRound(winnerId, reason) {
      const pot = gameState.pot || 0
      const isMe = winnerId === playerId

      if (isMe) {
        playSound('win')
        launchConfetti(3000)
        showToast(`You won ${pot} chips! 💰`, 'success', '🏆', 4000)
      } else {
        const winnerAi = aiPlayers.find(a => a.id === winnerId)
        playSound('fold')
        showToast(`${winnerAi ? winnerAi.display_name : 'AI'} wins ${pot} chips`, 'error', '😔', 3000)
      }

      resultsOverlay.classList.remove('hidden')
      resultsEmoji.textContent = isMe ? '🏆' : '😞'
      resultsTitle.textContent = isMe ? 'You Win!' : 'You Lost'
      resultsDetail.textContent = isMe
        ? `You won ${pot} chips! ${reason === 'all_ai_folded' ? 'Everyone folded!' : 'Best hand wins!'}`
        : `Better luck next round!`

      if (isMe) {
        potAmountEl.classList.add('pot-win')
        setTimeout(() => potAmountEl.classList.remove('pot-win'), 800)
      }

      // Show all hands
      resultsHands.innerHTML = ''
      // Player hand
      const myEval = evaluateHand(myHand.cards)
      const pRow = document.createElement('div')
      pRow.className = `results-hand-row${isMe ? ' winner' : ''}`
      pRow.innerHTML = `<span class="rh-name">${esc(playerName)} ${isMe ? '👑' : ''}</span><span class="rh-hand">${myEval.name}</span><span class="rh-cards">${myHand.cards.map(c => `<span class="${cardColor(c.suit)}">${c.rank}${c.suit}</span>`).join(' ')}</span>`
      resultsHands.appendChild(pRow)

      for (const ai of aiPlayers) {
        const aiEval = evaluateHand(ai.cards)
        const isWinner = ai.id === winnerId
        const row = document.createElement('div')
        row.className = `results-hand-row${isWinner ? ' winner' : ''}`
        row.innerHTML = `<span class="rh-name">${esc(ai.display_name)} ${isWinner ? '👑' : ''}${ai.has_folded ? ' (Folded)' : ''}</span><span class="rh-hand">${aiEval.name}</span><span class="rh-cards">${ai.cards.map(c => `<span class="${cardColor(c.suit)}">${c.rank}${c.suit}</span>`).join(' ')}</span>`
        resultsHands.appendChild(row)
      }
    }

    /* ===== AI DECISION ===== */
    function decideAiAction(ai) {
      const handScore = evaluateHand(ai.cards).score
      const r = Math.random()

      switch (aiDifficulty) {
        case 'easy':
          if (handScore < 1000) return r < 0.5 ? { type: 'fold' } : { type: 'call' }
          return { type: 'call' }
        case 'medium':
          if (handScore < 500) return r < 0.35 ? { type: 'fold' } : { type: 'call' }
          if (handScore > 3000) return r < 0.4 ? { type: 'raise', amount: Math.min(gameState.current_bet + 50, 200) } : { type: 'call' }
          return { type: 'call' }
        case 'hard':
          if (handScore < 500 && r < 0.3) return { type: 'bluff' }
          if (handScore > 2000) return { type: 'raise', amount: Math.min(gameState.current_bet + 100, 300) }
          if (handScore < 300) return r < 0.4 ? { type: 'fold' } : { type: 'bluff' }
          return { type: 'call' }
        case 'chaos':
          const actions = ['fold', 'call', 'raise', 'bluff']
          const pick = actions[Math.floor(Math.random() * actions.length)]
          if (pick === 'raise') return { type: 'raise', amount: Math.floor(Math.random() * 300) + 20 }
          return { type: pick }
        default:
          return { type: 'call' }
      }
    }

    /* ===== BLUFF ===== */
    function generateBluffClaim(hand) {
      const bluffs = [
        { text: 'I have a Full House!', rank: 6 },
        { text: 'Sitting on a Flush here', rank: 5 },
        { text: 'Three of a Kind, easy', rank: 3 },
        { text: 'I\'ve got a Straight!', rank: 4 },
        { text: 'Two Pair, feeling good', rank: 2 },
        { text: 'Four of a Kind! 😏', rank: 7 },
        { text: 'Just a pair... or is it? 🤔', rank: 1 },
        { text: 'Royal Flush, baby! 👑', rank: 9 },
      ]
      return bluffs[Math.floor(Math.random() * bluffs.length)]
    }

    function renderBluffClaim(bluff) {
      bluffZone.innerHTML = `
        <div class="bluff-claim">
          <div class="bluff-claim-text">"${esc(bluff.claim_text)}"</div>
          <div class="bluff-claim-by">— ${esc(bluff.player_name)}</div>
        </div>
      `
      playSound('bluff')
    }

    /* ===== ACTION LOG ===== */
    function addLogEntry(name, type, amount, message) {
      const entry = document.createElement('div')
      let cls = 'log-entry'
      let text = ''
      switch (type) {
        case 'fold': cls += ' log-fold'; text = `<strong>${esc(name)}</strong> folded`; break
        case 'call': cls += ' log-call'; text = `<strong>${esc(name)}</strong> called${amount ? ` ${amount}` : ''}`; break
        case 'check': cls += ' log-call'; text = `<strong>${esc(name)}</strong> checked`; break
        case 'raise': cls += ' log-raise'; text = `<strong>${esc(name)}</strong> raised to ${amount}`; break
        case 'bluff': cls += ' log-bluff'; text = `<strong>${esc(name)}</strong> claims: ${esc(message || '???')}`; break
        default: text = `<strong>${esc(name)}</strong> ${type}`; break
      }
      entry.className = cls
      entry.innerHTML = text
      actionLogInner.prepend(entry)
      // Keep max 30
      while (actionLogInner.children.length > 30) actionLogInner.lastChild.remove()
    }

    /* ===== UTILITY ===== */
    function esc(str) {
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
    }

    /* ===== HEARTBEAT ===== */
    setInterval(async () => {
      if (playerId) {
        try {
          await supabase.from(P_TABLE).update({ last_seen: new Date().toISOString(), is_online: true }).eq('id', playerId)
        } catch (e) { /* ok */ }
      }
    }, 30000)

    /* ===== CLEANUP ON UNLOAD ===== */
    window.addEventListener('beforeunload', () => {
      if (playerId) {
        navigator.sendBeacon && navigator.sendBeacon(
          `${SUPABASE_URL}/rest/v1/${P_TABLE}?id=eq.${playerId}`,
          ''
        )
      }
    })

    /* ===== INIT ===== */
    async function init() {
      const autoLoggedIn = await tryAutoLogin()
      if (!autoLoggedIn) {
        const savedName = localStorage.getItem(LS_NAME)
        if (savedName) nameInput.value = savedName
        showScreen('join')
      }
    }

    init()

  } catch (err) {
    console.error('App bootstrap error:', err.message, err.stack)
    document.body.innerHTML = `<div style="min-height:100vh;display:grid;place-items:center;background:#0b1a0f;color:#e8f5ec;font-family:Inter,sans-serif;padding:24px;"><div style="max-width:480px;text-align:center;"><h1 style="font-size:1.5rem;margin-bottom:12px;">Failed to load</h1><p style="color:#7da88a;">${err.message}</p></div></div>`
  }
})()

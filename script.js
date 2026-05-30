let cards = [];
let current = 0;
let seen = new Set();

async function generateCards() {
  const topic = document.getElementById('topic-input').value.trim();
  if (!topic) {
    showError('Please enter a topic or paste some notes first.');
    return;
  }

  const count = document.getElementById('card-count').value;

  setLoading(true);
  hideError();
  document.getElementById('flashcard-section').style.display = 'none';

  // BUG 6 FIX: Reset progress bar at the start of a new generation
  document.getElementById('progress-fill').style.width = '0%';

  const messages = ['🔍 Analyzing your notes…','🧠 Crafting smart questions…','✨ Perfecting answers…','✅ Almost ready…'];
  let msgIndex = 0;
  const msgInterval = setInterval(() => {
    msgIndex = (msgIndex + 1) % messages.length;
    document.getElementById('loading-text').textContent = messages[msgIndex];
  }, 1200);

  // BUG 4 FIX: Use try/catch/finally so setLoading(false) always runs
  try {
    cards = await generateFreeFlashcards(topic, count);

    if (!Array.isArray(cards) || cards.length === 0) {
      throw new Error('No flashcards generated. Try a different topic.');
    }

    current = 0;
    seen = new Set();
    clearInterval(msgInterval);
    renderCards();

  } catch (err) {
    clearInterval(msgInterval);
    showError('Error: ' + err.message + ' (Using smart generator instead)');
    // Fallback to smart generator
    cards = generateSmartFlashcards(topic, parseInt(count));
    current = 0;
    seen = new Set();
    renderCards();
  } finally {
    // BUG 4 FIX: Always runs — spinner never gets stuck
    setLoading(false);
  }
}

// BUG 2 FIX: Replaced DialoGPT (chat model) with Mistral-7B-Instruct
// which actually follows structured JSON instructions
async function generateFreeFlashcards(topic, count) {
  try {
    const prompt = `Generate exactly ${count} study flashcards about "${topic}".
Respond ONLY with a valid JSON array, no explanation, no markdown.
Format: [{"question":"...","answer":"..."}, ...]`;

    const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 1200, temperature: 0.7, return_full_text: false }
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data[0]?.generated_text) {
        const raw = data[0].generated_text;

        // BUG 1 FIX: Was /\$[\s\S]*\$/ which matched end-of-string markers,
        // not JSON brackets. Correct regex matches a JSON array.
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    }
  } catch (e) {
    console.log('AI service busy, using smart generator...');
  }

  // Smart fallback — always works
  return generateSmartFlashcards(topic, parseInt(count));
}

function generateSmartFlashcards(topic, count) {
  const flashcards = [];
  const words = topic.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 15);

  const templates = [
    { q: `What is ${getMainTerm(topic)}?`, a: `Core definition: ${words.slice(0,4).join(', ')} from your notes` },
    { q: `Define ${words[0] || 'main concept'}?`, a: `Key definition: ${topic.substring(0,80)}...` },
    { q: `What are the main parts of ${getMainTerm(topic)}?`, a: `Key components:\n• ${words[0] || 'Part 1'}\n• ${words[1] || 'Part 2'}\n• ${words[2] || 'Part 3'}` },
    { q: `Name 3 key elements?`, a: `1. ${words[0] || 'Element 1'}\n2. ${words[1] || 'Element 2'}\n3. ${words[2] || 'Element 3'}` },
    { q: `How does ${getMainTerm(topic)} work?`, a: `Process: ${words.slice(0,4).join(' → ')}` },
    { q: `First step in ${getMainTerm(topic)}?`, a: `Step 1: ${words[0] || 'Initiation'}` },
    { q: `Give an example of ${getMainTerm(topic)}`, a: `Example: ${words.slice(-3).join(' in ')} context` },
    { q: `Real-world use of ${getMainTerm(topic)}?`, a: `Applications: ${words.slice(1,4).join(', ')}` },
    { q: `Why is ${getMainTerm(topic)} important?`, a: `Key reasons: ${words.slice(0,3).join(', ')}` },
    { q: `Key takeaway from ${getMainTerm(topic)}?`, a: `Most important: ${words[0] || 'Core principle'}` },
    { q: `Recall: ${getMainTerm(topic)}`, a: `Active recall practice for ${topic.substring(0,50)}...` }
  ];

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    flashcards.push({ question: template.q, answer: template.a });
  }

  return flashcards;
}

function getMainTerm(topic) {
  return topic.split(' ')[0].replace(/[^\w]/g, '') || 'this concept';
}

function renderCards() {
  document.getElementById('total-count').textContent = cards.length;
  document.getElementById('tot').textContent = cards.length;
  buildDots();
  updateCard();
  const section = document.getElementById('flashcard-section');
  section.style.display = 'flex';
  section.style.flexDirection = 'column';
  section.style.alignItems = 'center';
}

function buildDots() {
  const row = document.getElementById('dots-row');
  row.innerHTML = '';
  cards.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'dot';
    d.onclick = () => goTo(i);
    row.appendChild(d);
  });
}

function updateCard() {
  // BUG 5 FIX: Guard against empty cards array
  if (!cards.length) return;

  const card3d = document.getElementById('card-3d');
  card3d.classList.remove('flipped');

  document.getElementById('q-text').textContent = cards[current].question;
  document.getElementById('a-text').textContent = cards[current].answer;
  document.getElementById('cur').textContent = current + 1;

  const pct = ((current + 1) / cards.length) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';

  seen.add(current);

  const dots = document.querySelectorAll('.dot');
  dots.forEach((d, i) => {
    d.className = 'dot';
    if (i === current) d.classList.add('active');
    else if (seen.has(i)) d.classList.add('seen');
  });

  document.getElementById('prev-btn').disabled = current === 0;
  document.getElementById('next-btn').disabled = current === cards.length - 1;
}

function flipCard() {
  document.getElementById('card-3d').classList.toggle('flipped');
}

function nextCard() {
  if (current < cards.length - 1) { current++; updateCard(); }
}

function prevCard() {
  if (current > 0) { current--; updateCard(); }
}

function goTo(i) {
  current = i;
  updateCard();
}

function resetAll() {
  cards = [];
  current = 0;
  seen = new Set();
  document.getElementById('flashcard-section').style.display = 'none';
  document.getElementById('topic-input').value = '';
  document.getElementById('progress-fill').style.width = '0%';
  hideError();
  document.getElementById('topic-input').focus();
}

function setLoading(show) {
  document.getElementById('loading').style.display = show ? 'flex' : 'none';
  document.getElementById('gen-btn').disabled = show;
  if (show) {
    document.getElementById('loading-text').textContent = '🔥 Generating FREE flashcards…';
  }
}

function showError(msg) {
  const box = document.getElementById('error-box');
  box.innerHTML = `<strong>⚠️</strong> ${msg}`;
  box.style.display = 'block';
}

function hideError() {
  document.getElementById('error-box').style.display = 'none';
}

// BUG 3 FIX: All event listeners centralised here.
// Removed all inline onclick="..." from HTML to prevent duplicate handler registration.
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('topic-input').addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') generateCards();
  });

  document.getElementById('gen-btn').addEventListener('click', generateCards);
  document.querySelector('.card-scene').addEventListener('click', flipCard);
  document.getElementById('prev-btn').addEventListener('click', prevCard);
  document.getElementById('next-btn').addEventListener('click', nextCard);
  document.querySelector('.btn-flip').addEventListener('click', flipCard);
  document.querySelector('.btn-reset').addEventListener('click', resetAll);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (document.getElementById('flashcard-section').style.display !== 'none') {
    if (e.key === 'ArrowLeft') prevCard();
    if (e.key === 'ArrowRight') nextCard();
    if (e.key === ' ') {
      e.preventDefault();
      flipCard();
    }
  }
});
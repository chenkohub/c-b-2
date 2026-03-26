/**
 * character.js
 * Scripted mentor lookup helpers.
 */

let characterPayload = null;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export async function loadCharacterData() {
  if (characterPayload) {
    return characterPayload;
  }

  const response = await fetch('./data/characters.json');
  if (!response.ok) {
    throw new Error(`Unable to load characters.json: ${response.status} ${response.statusText}`);
  }

  characterPayload = await response.json();
  return characterPayload;
}

export async function getCharacterById(characterId) {
  const payload = await loadCharacterData();
  const desiredId = characterId || payload?.defaultCharacterId;
  return safeArray(payload?.characters).find((character) => character.id === desiredId)
    || safeArray(payload?.characters)[0]
    || null;
}

function pickLine(lines = [], fallback = 'Keep the doctrine straight and the reasoning will follow.') {
  return safeArray(lines)[0] || fallback;
}

export async function getMentorContent(key, options = {}) {
  const character = await getCharacterById(options.characterId);
  if (!character) {
    return null;
  }

  const mood = options.mood || 'neutral';
  const avatar = character.avatars?.[mood] || character.avatars?.neutral || '';
  const line = pickLine(character.lines?.[key], options.fallbackLine);

  return {
    id: character.id,
    name: character.name,
    mood,
    avatar,
    line,
    notes: safeArray(character.mentorNotes)
  };
}

export async function getHomeMentorContent(profile) {
  const isNewPlayer = Object.values(profile?.scenarioProgress || {}).every((entry) => !entry?.completed);
  const key = isNewPlayer ? 'home:new-player' : 'home:returning-player';
  const mood = Number(profile?.streak?.currentDays || 0) >= 3 ? 'happy' : 'neutral';
  return getMentorContent(key, {
    characterId: profile?.settings?.mentorCharacterId,
    mood,
    fallbackLine: 'Welcome back to chambers.'
  });
}

export async function getResultsMentorContent(results, profile) {
  const percentage = Number(results?.percentage || 0);
  let key = 'results:default';
  let mood = 'neutral';
  if (percentage >= 95) {
    key = 'results:perfect';
    mood = 'happy';
  } else if (percentage < 60) {
    key = 'results:weak';
    mood = 'concerned';
  }

  return getMentorContent(key, {
    characterId: profile?.settings?.mentorCharacterId,
    mood,
    fallbackLine: 'Another opinion entered into the record.'
  });
}

export async function getMapMentorContent(profile, nodeStatus = 'locked') {
  const key = nodeStatus === 'locked' ? 'map:locked-node' : 'map:ready-node';
  return getMentorContent(key, {
    characterId: profile?.settings?.mentorCharacterId,
    mood: nodeStatus === 'locked' ? 'concerned' : 'neutral',
    fallbackLine: 'Choose the next doctrine carefully.'
  });
}

export async function getDashboardMentorContent(profile) {
  const key = (profile?.achievements?.earnedIds || []).length > 0 ? 'dashboard:achievement' : 'dashboard:default';
  return getMentorContent(key, {
    characterId: profile?.settings?.mentorCharacterId,
    mood: (profile?.achievements?.earnedIds || []).length > 0 ? 'happy' : 'neutral',
    fallbackLine: 'Track the doctrine that still gives you trouble.'
  });
}

export async function getLibraryMentorContent(profile) {
  return getMentorContent('library:default', {
    characterId: profile?.settings?.mentorCharacterId,
    fallbackLine: 'Use the library to revisit any difficult doctrine.'
  });
}

export async function getCodexMentorContent(profile) {
  return getMentorContent('codex:default', {
    characterId: profile?.settings?.mentorCharacterId,
    fallbackLine: 'Use the codex when you need the doctrinal spine of a scenario.'
  });
}

export const __testHooks = {
  clearCache() {
    characterPayload = null;
  }
};

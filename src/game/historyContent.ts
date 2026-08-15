export interface HistoryQuestion {
  question: string;
  answers: string[];
  correct: number;
  fact: string;
}

export const HISTORY_QUESTIONS: HistoryQuestion[] = [
  { question: "Who led the defence of Jhansi during the Revolt of 1857?", answers: ["Rani Lakshmibai", "Sarojini Naidu", "Begum Rokeya", "Annie Besant"], correct: 0, fact: "Rani Lakshmibai defended Jhansi in 1858 and became a major symbol of resistance." },
  { question: "The Battle of Longewala was fought during which war?", answers: ["1962 Sino-Indian War", "1965 Indo-Pak War", "1971 Indo-Pak War", "Kargil War"], correct: 2, fact: "The Battle of Longewala took place on 4–5 December 1971 in Rajasthan." },
  { question: "Who commanded 13 Kumaon at Rezang La in 1962?", answers: ["Major Somnath Sharma", "Major Shaitan Singh", "Captain Vikram Batra", "Abdul Hamid"], correct: 1, fact: "Major Shaitan Singh received the Param Vir Chakra for his leadership at Rezang La." },
  { question: "In which year did the Battle of Saragarhi take place?", answers: ["1757", "1857", "1897", "1919"], correct: 2, fact: "Twenty-one soldiers of the 36th Sikhs defended Saragarhi on 12 September 1897." },
  { question: "Which movement did Mahatma Gandhi launch in 1942?", answers: ["Swadeshi Movement", "Quit India Movement", "Khilafat Movement", "Home Rule Movement"], correct: 1, fact: "The Quit India Movement began in August 1942 with the call to 'Do or Die'." },
  { question: "Bhagat Singh was associated with which organisation?", answers: ["HSRA", "Indian National Congress", "Forward Bloc", "Azad Hind Fauj"], correct: 0, fact: "Bhagat Singh was a leading member of the Hindustan Socialist Republican Association." },
  { question: "Who founded the Mauryan Empire?", answers: ["Ashoka", "Bindusara", "Chandragupta Maurya", "Harshavardhana"], correct: 2, fact: "Chandragupta Maurya founded the Mauryan Empire around 322 BCE." },
  { question: "The Kalinga War transformed which emperor's outlook?", answers: ["Akbar", "Ashoka", "Samudragupta", "Krishnadevaraya"], correct: 1, fact: "The suffering caused by the Kalinga War led Ashoka toward dhamma and non-violence." },
  { question: "Who gave the call, 'Give me blood, and I will give you freedom'?", answers: ["Bal Gangadhar Tilak", "Subhas Chandra Bose", "Sardar Patel", "Lala Lajpat Rai"], correct: 1, fact: "Subhas Chandra Bose gave the famous call while leading the struggle of the Azad Hind movement." },
  { question: "Tiger Hill was recaptured during which operation?", answers: ["Operation Vijay", "Operation Meghdoot", "Operation Cactus", "Operation Trident"], correct: 0, fact: "Operation Vijay was India's 1999 campaign to clear the Kargil heights." },
  { question: "The Constitution of India came into effect on which date?", answers: ["15 August 1947", "26 November 1949", "26 January 1950", "2 October 1950"], correct: 2, fact: "India became a republic when the Constitution came into effect on 26 January 1950." },
  { question: "Who is known as the Iron Man of India?", answers: ["Sardar Vallabhbhai Patel", "Jawaharlal Nehru", "B. R. Ambedkar", "Rajendra Prasad"], correct: 0, fact: "Sardar Patel played a central role in integrating the princely states into India." },
];

export const MISSION_STORIES: Record<string, { chapter: string; setup: string; stakes: string }> = {
  longewala: { chapter: "Chapter I · The Desert Line", setup: "Night falls over a lonely Rajasthan border post. A much larger armoured force is moving down the desert track.", stakes: "Keep the post alive until dawn, when air support can finally enter the battle." },
  tigerhill: { chapter: "Chapter II · Above the Clouds", setup: "Your team climbs through darkness toward fortified sangars on Tiger Hill's exposed ridge.", stakes: "Clear each position and secure the summit before the defenders can reinforce it." },
  jhansi1858: { chapter: "Chapter III · The Rani's Ramparts", setup: "Cannon fire shakes Jhansi while the Rani rallies defenders across the fort walls.", stakes: "Hold the courtyards and prevent the siege column from breaking through." },
  ina1943: { chapter: "Chapter IV · Islands of Freedom", setup: "Azad Hind forces approach an island battery through palms, coral sand and coastal fire.", stakes: "Silence the battery and secure a landing route for the force behind you." },
  kerala1700: { chapter: "Chapter V · War in the Reeds", setup: "River raiders slip between backwater villages while Travancore levies form an ambush.", stakes: "Protect the settlement and break the raid before the attackers reach open water." },
  delhi1648: { chapter: "Chapter VI · Coup at the Red Fort", setup: "Rebel guards seize sandstone galleries and advance toward the Diwan-i-Aam.", stakes: "Hold the palace centre and restore control of the fort." },
  saragarhi: { chapter: "Chapter VII · The Signal Must Hold", setup: "Twenty-one soldiers stand between two frontier forts as a vast lashkar surrounds the post.", stakes: "Keep the signal line working and hold every approach for as long as possible." },
  kalinga: { chapter: "Chapter VIII · The Cost of Conquest", setup: "Mauryan and Kalingan forces collide around a stone temple plinth in a war that will change an emperor.", stakes: "Survive the assault—and witness why victory can carry an unbearable cost." },
  rezangla: { chapter: "Chapter IX · No Retreat", setup: "Charlie Company holds an isolated position in the frozen Chushul valley without artillery support.", stakes: "Defend the pass, conserve ammunition and deny every assault." },
  haifa1918: { chapter: "Chapter X · Lancers at Carmel", setup: "Jodhpur and Mysore Lancers face guns entrenched on the slopes above Haifa.", stakes: "Break the ridge batteries and open the road into the town." },
  panipat1761: { chapter: "Chapter XI · Dust and Thunder", setup: "The Maratha centre braces as cannon, cavalry and camel-guns disappear into the dust.", stakes: "Hold formation and stop the centre from collapsing." },
};

export function getReviveQuestion(): HistoryQuestion {
  return HISTORY_QUESTIONS[Math.floor(Math.random() * HISTORY_QUESTIONS.length)] ?? HISTORY_QUESTIONS[0];
}
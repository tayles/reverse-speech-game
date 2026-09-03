/** Phrase ideas for when nobody can think of anything to say. */
export const PHRASE_PACKS: { name: string; emoji: string; phrases: string[] }[] = [
  {
    name: 'Easy peasy',
    emoji: '🍋',
    phrases: [
      'Hello there',
      'Big red bus',
      'Ice cream',
      'Good morning',
      'Jelly beans',
      'Rainy day',
      'Yellow duck',
      'Bath time',
      'Sleepy cat',
      'Purple socks',
    ],
  },
  {
    name: 'Silly stuff',
    emoji: '🤪',
    phrases: [
      'Wobbly jelly',
      'Stinky cheese',
      'Bouncing beans',
      'Grumpy hamster',
      'Noodle trousers',
      'Dancing potato',
      'Sneezy dragon',
      'Bubble wrap',
      'Squeaky shoes',
      'Banana pyjamas',
    ],
  },
  {
    name: 'Tricky twisters',
    emoji: '🌀',
    phrases: [
      'Red lorry yellow lorry',
      'She sells seashells',
      'Unique New York',
      'Six slippery snails',
      'Toy boat',
      'Crisp crusts crackle',
      'Freshly fried fish',
      'Truly rural',
      'Irish wristwatch',
      'A proper copper coffee pot',
    ],
  },
  {
    name: 'Space and monsters',
    emoji: '👾',
    phrases: [
      'Alien spaceship',
      'Moon rocks',
      'Giant robot',
      'Slimy monster',
      'Black hole',
      'Rocket launch',
      'Three eyed goblin',
      'Galaxy far away',
      'Zombie picnic',
      'Laser beam',
    ],
  },
]

export const ALL_PHRASES = PHRASE_PACKS.flatMap((p) => p.phrases)

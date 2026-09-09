// The actual story/news content, unchanged from the dev version — split
// into its own file so seed.js (below) can focus on the database logic.
module.exports = [
  // ---------- STORIES (evergreen) ----------
  {
    content_type: 'story',
    category: 'kindness',
    title: 'The Brave Little Snail',
    read_minutes: 4,
    quiz: [
      { question: 'What kind of animal was Sam?', options: ['A snail', 'A dragonfly', 'A ladybug'], correct: 0 },
      { question: 'How did Sam help the ladybug?', options: ['He raced past her', 'He pushed the leaf aside', 'He ignored her'], correct: 1 },
    ],
    vocabulary: [
      { word: 'meadow', definition: 'A field full of grass, flowers, and small critters.' },
      { word: 'buzzed', definition: 'Made a fast, humming sound while talking.' },
      { word: 'gently', definition: "In a soft, careful way that doesn't hurt anything." },
      { word: 'steady', definition: 'Moving in a slow, calm way without rushing.' },
    ],
    body: `Sam the snail was the smallest in Sunny Meadow. Every day, the other bugs raced past him without stopping. "You're too slow to play with us," buzzed a dragonfly. Sam felt sad, but he kept smiling.

One rainy morning, a baby ladybug got stuck under a big leaf. She was too scared to move. All the fast bugs zoomed by, too busy to notice. But slow, steady Sam saw her. He gently pushed the leaf aside with his shell, one tiny step at a time.

"Thank you for not giving up on me," said the ladybug. From that day on, everyone in Sunny Meadow knew that being kind matters more than being fast. Sam the snail became everyone's favorite friend.`,
  },
  {
    content_type: 'story',
    category: 'space',
    title: 'A Trip to the Moon',
    read_minutes: 4,
    quiz: [
      { question: "Why do astronauts bounce when they walk on the Moon?", options: ['The Moon is very hot', "The Moon's gravity is weaker", 'The Moon is made of ice'], correct: 1 },
      { question: 'Does the Moon make its own light?', options: ['Yes, it glows by itself', "No, it reflects the Sun's light", 'It only glows at noon'], correct: 1 },
    ],
    vocabulary: [
      { word: 'astronauts', definition: 'People who travel and work up in space.' },
      { word: 'gravity', definition: 'The invisible pull that keeps your feet on the ground.' },
      { word: 'reflecting', definition: 'Bouncing light back, the way a mirror does.' },
      { word: 'glowing', definition: 'Giving off a soft, warm light.' },
    ],
    body: `Did you know the Moon is closer to us than any other place in space? If you could drive a car straight up into the sky, it would take about six months to get there!

The Moon doesn't have air to breathe, so astronauts wear special suits with their own air inside. When astronauts walk on the Moon, they bounce more than they walk, because the Moon's gravity is much weaker than Earth's. That means if you could jump on the Moon, you could leap over a school bus!

At night, look up and find the Moon glowing in the sky. It isn't making its own light — it's actually reflecting light from the Sun, like a giant mirror in space.`,
  },
  {
    content_type: 'story',
    category: 'nature',
    title: 'Why the Sky Turns Orange',
    read_minutes: 3,
    quiz: [
      { question: 'What color does the sky usually look like in the daytime?', options: ['Green', 'Blue', 'Purple'], correct: 1 },
      { question: 'Why does the sunset look orange and pink?', options: ['The blue light gets scattered away', 'The sun changes color', 'Clouds paint the sky'], correct: 0 },
    ],
    vocabulary: [
      { word: 'scattered', definition: 'Spread out in lots of different directions.' },
      { word: 'sunset', definition: 'The time each evening when the sun goes down and the sky changes color.' },
      { word: 'direction', definition: 'The way something is pointing or moving, like up, down, or sideways.' },
    ],
    body: `Every evening, the sky puts on a colorful show. In the daytime, the sky looks blue because sunlight bounces off tiny bits of air in every direction, and blue light bounces the most.

But when the sun starts to set, its light has to travel through much more sky to reach your eyes. Along the way, the blue light gets scattered away, leaving behind the warm oranges, pinks, and reds we see at sunset.

That's why the sky can look like it's on fire with color right before night begins! The next time you watch a sunset, you're watching sunlight taking the long way home.`,
  },
  {
    content_type: 'story',
    category: 'kindness',
    title: 'The Kindest Elephant in the Jungle',
    read_minutes: 4,
    quiz: [
      { question: 'What did Ellie use to give the animals water?', options: ['A cup', 'Her trunk', 'A bucket'], correct: 1 },
      { question: 'What did Ellie say the biggest animal should have?', options: ['The biggest lunch', 'The biggest heart', 'The biggest house'], correct: 1 },
    ],
    vocabulary: [
      { word: 'trunk', definition: "An elephant's long nose, used almost like a hand." },
      { word: 'thirsty', definition: 'Feeling like you really need a drink of water.' },
      { word: 'jungle', definition: 'A thick, green forest full of plants and animals.' },
    ],
    body: `Ellie the elephant was the biggest animal in the jungle, but she had the gentlest heart. One hot afternoon, the jungle's only water hole had almost dried up. The smaller animals — mice, rabbits, and turtles — couldn't reach the little bit of water left at the bottom.

Ellie walked to the water hole, filled her long trunk, and gently sprayed water into a leaf bowl for each animal to drink. She did this again and again until every thirsty friend had a drink.

"You could have kept it all for yourself," said a tiny mouse. Ellie smiled. "The biggest animal should have the biggest heart too," she said. From then on, all the jungle animals knew they had a true friend in Ellie.`,
  },
  {
    content_type: 'story',
    category: 'nature',
    title: 'How Bees Say Thank You',
    read_minutes: 3,
    quiz: [
      { question: 'What does a bee collect from flowers?', options: ['Nectar', 'Leaves', 'Sticks'], correct: 0 },
      { question: 'How do bees help new flowers grow?', options: ['By watering them', 'By carrying pollen between flowers', 'By singing to them'], correct: 1 },
    ],
    vocabulary: [
      { word: 'nectar', definition: 'The sweet liquid inside flowers that bees love to drink.' },
      { word: 'pollen', definition: 'Tiny yellow dust from flowers that helps new plants grow.' },
      { word: 'buzzing', definition: "The humming sound a bee's wings make." },
      { word: 'bloom', definition: 'To open up into a flower.' },
    ],
    body: `When a bee visits a flower, something amazing happens. The bee is looking for sweet nectar to bring home and turn into honey. While it drinks, tiny grains of yellow pollen stick to its fuzzy legs.

When the bee flies to the next flower, some of that pollen rubs off — and that's how new flowers, fruits, and seeds get to grow! So every time a bee sips from a flower, it's saying thank you in the best way it knows how: by helping a brand new flower bloom.

The next time you see a bee buzzing by, give it space to work — it's busy doing one of the most important jobs in the whole garden.`,
  },

  // ---------- KIDS WORLD NEWS (real events, retold simply) ----------
  {
    content_type: 'news',
    category: 'ocean',
    title: 'Whale Families Are Growing!',
    read_minutes: 4,
    quiz: [
      { question: 'How many baby whales were counted this year?', options: ['3', '23', '100'], correct: 1 },
      { question: 'What are people doing to help whale families?', options: ['Slowing down boats near them', 'Catching them', 'Nothing'], correct: 0 },
    ],
    vocabulary: [
      { word: 'calves', definition: 'Baby whales.' },
      { word: 'scientists', definition: 'People whose job is to study and learn about the world.' },
      { word: 'nurseries', definition: 'Safe, cozy places where babies are cared for.' },
      { word: 'enormous', definition: 'Extremely, extremely big.' },
    ],
    body: `Great news from the ocean! This year, scientists counted 23 baby North Atlantic right whales — more new whale calves than they've seen in almost twenty years.

Right whales are enormous, gentle giants that can grow longer than a school bus, and for a while, scientists were worried there weren't enough babies being born. People who study whales worked hard to keep the ocean safer for them, and it's working — boats now slow down in whale nurseries, and helpers watch out for whale families along the coast.

Somewhere in the ocean right now, a baby whale is swimming close beside its mama, learning how to be a whale. Scientists say this is one of the best baby whale seasons in a long time.`,
  },
  {
    content_type: 'news',
    category: 'ocean',
    title: 'Turtle Helpers Save Baby Turtles',
    read_minutes: 4,
    quiz: [
      { question: 'Who protects the turtle nests at night?', options: ['Turtle helpers', 'Fish', 'No one'], correct: 0 },
      { question: 'What happens to baby turtles after they hatch now?', options: ['They get lost', 'They get a safe path to the water', 'They stay in the sand'], correct: 1 },
    ],
    vocabulary: [
      { word: 'islands', definition: 'Pieces of land with water all around them.' },
      { word: 'nests', definition: 'Safe little spots where eggs are laid and kept warm.' },
      { word: 'hatched', definition: 'Broke out of an egg.' },
      { word: 'protecting', definition: 'Keeping something safe from harm.' },
    ],
    body: `On a group of islands in Indonesia called the Kei Islands, something wonderful has been happening. Years ago, people worried that leatherback sea turtles — some of the biggest turtles in the world — were in trouble, because their eggs weren't safe on the beach.

So local turtle helpers started watching the nests every single night, protecting the eggs until they safely hatched. Baby turtles that hatch now get a safe, clear path down to the water.

Since the helpers started this work, turtle nests being disturbed has dropped by 85 percent — that means almost all the nests are safe now! Every baby turtle that makes it to the ocean has a whole team of turtle helpers to thank.`,
  },
  {
    content_type: 'news',
    category: 'invention',
    title: 'The Sidewalk That Drinks Rain',
    read_minutes: 4,
    quiz: [
      { question: 'What problem was Luca trying to solve?', options: ['Streets flooding', 'Too much sunshine', 'Noisy cars'], correct: 0 },
      { question: 'What did Luca mix to make the sidewalk?', options: ['Sand and water', 'Oyster shells and charcoal', 'Wood and glue'], correct: 1 },
    ],
    vocabulary: [
      { word: 'invent', definition: "To think up and build something brand new that didn't exist before." },
      { word: 'flood', definition: "When too much water covers a place that's usually dry." },
      { word: 'material', definition: 'The stuff something is made out of.' },
      { word: 'soak', definition: 'To take in liquid, the way a sponge does.' },
    ],
    body: `A sixth-grader named Luca had a big idea to solve a soggy problem: streets that flood when it rains hard. Luca mixed together crushed oyster shells, seashells, charcoal, and gravel to invent a brand new kind of sidewalk material — one that can actually soak up rainwater like a sponge instead of letting it puddle up!

When it rains, Luca's special sidewalk drinks up the extra water before it can flood the street. Luca's invention could one day help keep neighborhoods dry during big storms.

It just goes to show: you don't have to be a grown-up scientist to invent something that helps your whole town. Sometimes the best ideas start with one kid asking, "what if?"`,
  },
  {
    content_type: 'news',
    category: 'space',
    title: 'Look Up! A Big Month for Skywatching',
    read_minutes: 4,
    quiz: [
      { question: 'Which planet shines extra bright in the story?', options: ['Mars', 'Venus', 'Jupiter'], correct: 1 },
      { question: 'What is the Harvest Moon near in the sky?', options: ['Saturn', 'The Sun', 'A rainbow'], correct: 0 },
    ],
    vocabulary: [
      { word: 'planet', definition: 'A giant round world that travels around the Sun.' },
      { word: 'glowing', definition: 'Giving off a soft light.' },
      { word: 'rises', definition: 'Moves up into the sky.' },
      { word: 'spot', definition: 'To notice or see something.' },
    ],
    body: `September is a wonderful month to look up at the night sky! Early in the month, the planet Venus shines brighter than it has all year, glowing low in the sky just after sunset — some people call it the "evening star," even though it's really a planet.

Later in the month, a big, golden Harvest Moon rises in the east, and if you look closely nearby, you might spot the planet Saturn glowing next to it. There's even a special night called International Observe the Moon Night, when families all over the world step outside together to look up at the Moon at the very same time.

So grab a grown-up, go outside after dinner, and see what you can spot!`,
  },
  {
    content_type: 'news',
    category: 'animals',
    title: 'A Very Special Zoo Baby',
    read_minutes: 4,
    quiz: [
      { question: 'What kind of animal was born at the Detroit Zoo?', options: ['A gorilla', 'A giraffe', 'A tiger'], correct: 0 },
      { question: 'How long had the zoo waited for this kind of birth?', options: ['1 year', '10 years', '96 years'], correct: 2 },
    ],
    vocabulary: [
      { word: 'newborn', definition: 'A baby that was just born.' },
      { word: 'zookeepers', definition: 'People whose job is to take care of animals at the zoo.' },
      { word: 'forage', definition: 'To search around for food.' },
      { word: 'intelligent', definition: 'Smart — able to learn and understand things well.' },
    ],
    body: `The Detroit Zoo just welcomed a very special visitor: a baby gorilla, born for the very first time in the zoo's entire 96-year history! The baby's mother, a gorilla named Bandia, is taking gentle care of her newborn, holding her close and keeping her warm, just like gorilla mothers have done for their babies forever.

Zookeepers say the baby is healthy and growing stronger every day. Gorillas are very intelligent and caring animals, and baby gorillas often stay close to their mothers for years, learning how to climb, forage for food, and be part of their family group.

Everyone at the zoo is celebrating this happy, once-in-a-lifetime arrival.`,
  },
];

/**
 * The reply box's emoji picker: the emojis people use most in business chats,
 * grouped like WhatsApp's picker. Each entry is the emoji, then the words it
 * is found by. Kept local (no emoji library or download).
 */

export interface Emoji {
  char: string;
  /** Lowercase words to search by; the first is its name. */
  words: string[];
}

export interface EmojiCategory {
  id: string;
  label: string;
  emojis: Emoji[];
}

const parse = (lines: string): Emoji[] =>
  lines
    .trim()
    .split("\n")
    .map((line) => {
      const [char, ...words] = line.trim().split(/\s+/);
      return { char, words };
    });

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "smileys",
    label: "Smileys",
    emojis: parse(`
      😀 grinning smile happy
      😃 smiley happy joy
      😄 smile happy laugh
      😁 grin happy teeth
      😆 laughing happy haha
      😅 sweat-smile relief nervous
      😂 joy tears laugh lol
      🤣 rofl rolling laugh lol
      🙂 slight-smile ok
      🙃 upside-down silly
      😉 wink flirt
      😊 blush smile happy
      😇 innocent angel halo
      🥰 love hearts adore
      😍 heart-eyes love crush
      🤩 star-struck wow amazing
      😘 kiss love blow
      😋 yum tasty delicious
      😛 tongue playful
      😜 wink-tongue crazy joke
      🤪 zany crazy goofy
      🤗 hug thanks warm
      🤭 giggle oops hand
      🤫 shush quiet secret
      🤔 thinking hmm wonder
      🤐 zipper quiet secret
      😐 neutral meh
      😑 expressionless blank
      😶 no-mouth silent
      😏 smirk sly
      😒 unamused bored
      🙄 eye-roll whatever
      😬 grimace awkward
      😌 relieved calm
      😔 pensive sad
      😪 sleepy tired
      😴 sleeping zzz tired
      😷 mask sick ill
      🤒 thermometer sick fever
      🤧 sneeze sick cold
      🥵 hot heat sweat
      🥶 cold freezing
      🤯 mind-blown shocked wow
      🥳 party celebrate birthday
      😎 cool sunglasses
      🤓 nerd geek glasses
      🧐 monocle inspect curious
      😕 confused unsure
      😟 worried concerned
      🙁 frown sad
      😮 open-mouth surprised wow
      😲 astonished shocked
      😳 flushed embarrassed
      🥺 pleading puppy please
      😢 cry sad tear
      😭 sob crying sad
      😱 scream scared shocked
      😖 confounded upset
      😞 disappointed sad
      😓 downcast sweat tired
      😩 weary tired
      😫 tired exhausted
      😤 triumph frustrated huff
      😡 angry mad rage
      😠 annoyed angry
      🤬 cursing swear angry
      😈 devil mischief
      💀 skull dead lol
      💩 poop
      🤡 clown silly
      👻 ghost boo
      👽 alien
      🤖 robot bot
    `),
  },
  {
    id: "people",
    label: "Gestures",
    emojis: parse(`
      👋 wave hello hi bye
      🤚 raised-back hand stop
      ✋ hand stop high-five
      🖐️ hand-fingers five
      👌 ok perfect fine
      🤌 pinched italian what
      ✌️ victory peace
      🤞 fingers-crossed luck hope
      🤟 love-you
      🤘 rock horns
      🤙 call-me shaka
      👈 point-left
      👉 point-right
      👆 point-up
      👇 point-down
      ☝️ index-up one
      👍 thumbs-up yes like good ok
      👎 thumbs-down no dislike bad
      ✊ fist power
      👊 punch fist-bump
      👏 clap applause bravo
      🙌 raised-hands hooray celebrate
      👐 open-hands
      🤲 palms-up
      🤝 handshake deal agreement
      🙏 pray please thanks namaste
      ✍️ writing write
      💪 muscle strong flex
      👀 eyes look see
      🧠 brain smart think
      👶 baby
      🧑 person
      👨 man
      👩 woman
      🧑‍💻 technologist developer laptop
      🧑‍💼 office-worker business
      🙋 raising-hand question me
      🤷 shrug dunno whatever
      🤦 facepalm ugh
      🙇 bow sorry thanks
      💁 tipping-hand info
      🙆 ok-gesture yes
      🙅 no-gesture stop
      🏃 running run hurry
      💃 dancing dance
      👯 party dancers
    `),
  },
  {
    id: "hearts",
    label: "Hearts",
    emojis: parse(`
      ❤️ red-heart love
      🧡 orange-heart
      💛 yellow-heart
      💚 green-heart
      💙 blue-heart
      💜 purple-heart
      🖤 black-heart
      🤍 white-heart
      🤎 brown-heart
      💔 broken-heart sad
      ❤️‍🔥 heart-on-fire passion
      💕 two-hearts love
      💞 revolving-hearts
      💓 beating-heart
      💗 growing-heart
      💖 sparkling-heart
      💘 cupid arrow
      💝 heart-gift ribbon
      💯 hundred perfect score
      💢 anger
      💥 boom collision
      💫 dizzy stars
      💬 speech chat message
      💭 thought bubble
      💤 zzz sleep
    `),
  },
  {
    id: "nature",
    label: "Nature",
    emojis: parse(`
      🐶 dog puppy
      🐱 cat kitten
      🐭 mouse
      🐰 rabbit bunny
      🦊 fox
      🐻 bear
      🐼 panda
      🐨 koala
      🐯 tiger
      🦁 lion
      🐮 cow
      🐷 pig
      🐸 frog
      🐵 monkey
      🙈 see-no-evil monkey oops
      🙉 hear-no-evil monkey
      🙊 speak-no-evil monkey
      🐔 chicken
      🐧 penguin
      🐦 bird
      🦋 butterfly
      🐝 bee
      🐢 turtle slow
      🐍 snake
      🐙 octopus
      🐬 dolphin
      🐳 whale
      🌸 cherry-blossom flower
      🌹 rose flower
      🌻 sunflower
      🌷 tulip
      🌱 seedling grow
      🌳 tree
      🌴 palm-tree beach
      🍀 four-leaf-clover luck
      🍁 maple-leaf autumn
      ☀️ sun sunny
      🌤️ sun-cloud
      ⛅ cloudy
      🌧️ rain
      ⛈️ storm thunder
      ❄️ snowflake cold
      🌈 rainbow
      🔥 fire hot lit
      💧 droplet water
      🌊 wave ocean sea
      🌙 moon night
      ⭐ star
      🌟 glowing-star
      ✨ sparkles shine new
      ⚡ lightning zap fast
    `),
  },
  {
    id: "food",
    label: "Food",
    emojis: parse(`
      🍎 apple
      🍊 orange
      🍋 lemon
      🍌 banana
      🍉 watermelon
      🍇 grapes
      🍓 strawberry
      🥭 mango
      🍍 pineapple
      🥥 coconut
      🥑 avocado
      🌶️ chili hot spicy
      🌽 corn
      🥕 carrot
      🍞 bread
      🧀 cheese
      🍳 cooking egg breakfast
      🍔 burger
      🍟 fries
      🍕 pizza
      🌭 hotdog
      🌮 taco
      🥗 salad
      🍜 noodles ramen
      🍛 curry rice
      🍣 sushi
      🍦 ice-cream
      🍩 doughnut donut
      🍪 cookie
      🎂 birthday-cake
      🍰 cake
      🧁 cupcake
      🍫 chocolate
      🍬 candy sweet
      ☕ coffee tea hot
      🍵 tea
      🥤 drink soda
      🧃 juice
      🍺 beer
      🍻 cheers beers
      🥂 champagne toast cheers
      🍷 wine
    `),
  },
  {
    id: "activities",
    label: "Activities",
    emojis: parse(`
      🎉 party celebrate tada congrats
      🎊 confetti celebrate
      🎈 balloon party
      🎁 gift present
      🎀 ribbon
      🏆 trophy win award
      🥇 gold-medal first winner
      🥈 silver-medal second
      🥉 bronze-medal third
      🏅 medal
      ⚽ soccer football
      🏀 basketball
      🏏 cricket
      🎾 tennis
      🏸 badminton
      🎯 target goal bullseye
      🎮 video-game gaming
      🎲 dice game
      🧩 puzzle
      🎨 art palette
      🎬 movie film
      🎤 microphone sing
      🎧 headphones music
      🎵 music note
      🎶 music notes
      🎸 guitar
      🚀 rocket launch fast
      ✈️ airplane travel flight
      🚗 car drive
      🚕 taxi cab
      🚚 truck delivery shipping
      🛵 scooter delivery
      🚲 bicycle bike
      🏠 home house
      🏢 office building
      🏖️ beach holiday
      ⛰️ mountain
      🌍 globe world earth
      🗺️ map
    `),
  },
  {
    id: "objects",
    label: "Objects",
    emojis: parse(`
      📱 phone mobile
      💻 laptop computer
      🖥️ desktop computer
      ⌨️ keyboard
      🖨️ printer
      📷 camera photo
      📹 video camera
      📞 telephone call
      ☎️ phone call
      📠 fax
      🔋 battery
      🔌 plug
      💡 bulb idea
      🔦 flashlight
      🕯️ candle
      💸 money-wings spend
      💵 dollar money cash
      💰 money-bag rich
      💳 credit-card payment card
      🧾 receipt bill invoice
      💎 gem diamond
      🛒 cart shopping
      🛍️ shopping-bags
      📦 package box delivery
      📫 mailbox mail
      📧 email mail
      ✉️ envelope letter
      📝 memo note write
      📄 page document
      📋 clipboard
      📅 calendar date
      📆 calendar schedule
      🗓️ spiral-calendar planner
      📌 pin pushpin
      📍 location pin place
      📎 paperclip attach
      ✂️ scissors cut
      🔒 lock locked secure
      🔓 unlocked open
      🔑 key
      🔨 hammer tool
      🛠️ tools fix
      ⚙️ gear settings
      🧲 magnet
      📊 bar-chart stats
      📈 chart-up growth increase
      📉 chart-down decrease
      📚 books study
      📖 open-book read
      🔔 bell notification
      📣 megaphone announce broadcast
      📢 loudspeaker announce
      ⏰ alarm clock time
      ⏳ hourglass waiting
      ⌛ hourglass-done time
      🔍 search magnify
    `),
  },
  {
    id: "symbols",
    label: "Symbols",
    emojis: parse(`
      ✅ check yes done tick
      ☑️ check-box done
      ✔️ check-mark tick
      ❌ cross no wrong x
      ❎ cross-box
      ⭕ circle
      🚫 prohibited no forbidden
      ⛔ no-entry stop
      ⚠️ warning caution
      ❗ exclamation important
      ❓ question
      ‼️ double-exclamation
      ⁉️ interrobang
      ➕ plus add
      ➖ minus
      ➗ divide
      ✖️ multiply
      🔴 red-circle
      🟠 orange-circle
      🟡 yellow-circle
      🟢 green-circle
      🔵 blue-circle
      🟣 purple-circle
      ⚫ black-circle
      ⚪ white-circle
      🔺 red-triangle up
      🔻 down-triangle
      ➡️ right-arrow next
      ⬅️ left-arrow back
      ⬆️ up-arrow
      ⬇️ down-arrow
      🔄 refresh repeat
      🔁 repeat loop
      🆕 new
      🆓 free
      🆗 ok
      🆙 up
      🔝 top
      🔜 soon
      ℹ️ info information
      #️⃣ hash number
      *️⃣ asterisk
      ©️ copyright
      ®️ registered
      ™️ trademark
      💲 dollar-sign price
      ♻️ recycle
      🏁 finish flag
      🚩 red-flag
    `),
  },
];

export const ALL_EMOJIS: Emoji[] = EMOJI_CATEGORIES.flatMap((category) => category.emojis);

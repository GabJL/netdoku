// English texts for Netdoku.
(function () {
  "use strict";

  const plural = (n, one, many) => (n === 1 ? one : many);

  const NODES = {
    client: "user computer", server: "server", web: "web server", dns: "DNS server",
    mail: "mail server", storage: "file server", multimedia: "multimedia server", dhcp: "DHCP server",
  };

  function clue(c, L) {
    const s = c.slots || {};
    const params = c.parameters || {};
    const p = c.packet;

    const net = (slot) => {
      const n = L.network(slot.ref);
      switch (slot.form) {
        case "prefix": return `network ${n.prefix}`;
        case "size_rank": return slot.value === "most" ? "the network with the most addresses" : "the network with the fewest addresses";
        case "ip_member": return `the network of address ${slot.value}`;
        default: return `the ${n.name} network (${n.prefix})`;
      }
    };
    const node = (slot) => {
      const n = L.node(slot.ref);
      const label = L.nodeLabel(n);
      switch (slot.form) {
        case "label": return `the ${label}`;
        case "label_prefix": return `the ${label} in network ${L.network(n.network).prefix}`;
        case "ip": return `the ${label} ${slot.value}`;
        default: return `the ${label} in the ${L.network(n.network).name} network`;
      }
    };
    const router = (slot) => {
      if (slot.form === "interfaces") return `with interfaces ${slot.value[0]} and ${slot.value[1]}`;
      const [a, b] = L.router(slot.ref).connectedNetworks
        .map((id) => L.network(id))
        .map((n) => (slot.form === "networks_prefix" ? n.prefix : n.name));
      return `joining ${a} and ${b}`;
    };
    const length = (slot) => {
      const n = slot.ref;
      switch (slot.form) {
        case "address_count": return `a network with ${2 ** (32 - n)} addresses`;
        case "mask": return `a network with mask ${L.mask(n)}`;
        default: return `a /${n} network`;
      }
    };

    switch (c.type) {
      case "network.in_network":
        return `Packet ${p} was in ${net(s.net || { ref: params.networkId })}.`;
      case "network.prefix_length":
        return `Packet ${p} was in ${length(s.len || { ref: params.prefixLength })}.`;
      case "node.adjacent_to_node":
        if (params.nodeId) return `Packet ${p} was next to ${node(s.node || { ref: params.nodeId })}.`;
        return `Packet ${p} was next to a ${params.service ? NODES[params.service] : NODES[params.nodeType]}.`;
      case "node.unique_adjacent_to_node":
        return `Packet ${p} was next to ${node(s.node || { ref: params.nodeId })}, and no other packet was.`;
      case "router.adjacent_to_router":
        return `Packet ${p} was next to the router ${router(s.router || { ref: params.routerId })}.`;
      case "spatial.in_row":
        return `Packet ${p} was in row ${params.row}.`;
      case "spatial.in_column":
        return `Packet ${p} was in column ${params.column}.`;
      default:
        return c.text;
    }
  }

  window.NetdokuI18n.register("en", {
    langName: "English",
    tiers: { 1: "Very easy", 2: "Easy", 3: "Medium", 4: "Hard", 5: "Very hard" },
    networks: {
      admin: "Administration", services: "Services", lab: "Lab", dev: "Development",
      management: "Management", classrooms: "Classrooms", library: "Library", guests: "Guests",
      office: "Office", research: "Research",
    },
    nodes: NODES,
    nodeText: { client: "PC", web: "Web", dns: "DNS", mail: "Mail", storage: "Files", multimedia: "Media", dhcp: "DHCP" },
    clue,

    ui: {
      language: "Language",
      tagline: "A deduction game for learning computer networks",
      back: "Back",
      toMenu: "Main menu",
      menu: {
        howto: "How to play",
        play: "Play",
        stats: "Statistics",
        help: "Help",
        about: "About",
      },
      loadError: "The level list could not be read. Serve the folder with a web server (see README.md).",
      levelLoadError: "The level could not be loaded.",
      fileError: "The file is not a valid JSON level.",
      freePlay: "Level loaded from a file: it does not count for the statistics.",
    },

    game: {
      lives: "Lives",
      anotherLevel: "Another level of this difficulty",
      categoryInfo: "Theory and rules of the category",
      helpTitle: "Help",
      fullHelp: "Open the full help",
      networks: "Networks",
      cluesOfLevel: "Clues in this level",
      board: "Board",
      modePlace: "Place mode",
      modeNote: "Note mode: taps add or remove notes",
      modeShortcut: "Shortcut: A key",
      packet: "Packet {id}",
      victim: "victim",
      where: "row {r}, column {c}",
      hide: "▾ hide",
      showClues: ({ n }) => `▸ ${n} ${plural(n, "clue", "clues")}`,
      noCluesVictim: "No clues: found by elimination.",
      noClues: "No clues of its own.",
      meta: ({ category, dots, tier, n }) => `${category} · Difficulty ${dots} ${tier} · ${n} ${plural(n, "clue", "clues")}`,
      metaDetail: "logic {logic}, reading {reading}",
      title: "{category} · {tier}",
      objective: ({ victim }) => `Place the packets to find the attacker. Each row and each column has at most one packet. The victim is packet ${victim}: there was only one other packet in its network, the attacker.`,
      sizeNote: "Cells do not show the size of a network: its size is its number of addresses.",
      routerName: ({ a, b }) => `Router between ${a} and ${b}`,
      resumed: "Your progress in this level has been restored.",
      selectFirst: "First select a packet in the panel to take notes.",
      occupiedNode: "That cell is taken by a device.",
      occupiedPacket: "That cell is taken by packet {id}.",
      rowTaken: "Packet {id} is already in row {r}.",
      columnTaken: "Packet {id} is already in column {c}.",
      oneEach: "There can be only one packet per row and per column.",
      solved: "Level solved!",
      placedOk: "Packet {id} is in the right place.",
      wrongCell: "Packet {id} was not in row {r}, column {c}.",
      loseLife: "You lose a life.",
      stars: ({ n, max }) => `${n} of ${max} stars`,
      perfect: "Perfect: no mistakes!",
      withErrors: ({ n }) => `Solved with ${n} ${plural(n, "mistake", "mistakes")}. Without mistakes you get all three stars.`,
      best: ({ n }) => `Your best result in this difficulty: ${n} ${plural(n, "star", "stars")}.`,
      unlocked: "You have unlocked the next difficulty.",
      attacker: ({ attacker, net, victim }) => `The attacker is packet ${attacker}: the only other packet in the ${net} network, where the victim ${victim} was.`,
      lost: "You have run out of lives. Try another level of this difficulty.",
      newLevel: "Another level",
      nextDifficulty: "Next difficulty ›",
      backToCategory: "Back to the category",
      confirmNew: "Start another level? Your progress in this one will be lost.",
    },

    play: {
      title: "Play",
      intro: "Choose a category and a difficulty. Every time you play a difficulty you get a different level. To open a difficulty you must solve the previous one; all categories are open.",
      completed: "Completed",
      progress: ({ stars, max }) => `${stars} of ${max} stars`,
      locked: "Solve the previous difficulty to unlock it",
      info: "Theory and rules",
      noLevels: "There are no levels in this difficulty yet.",
      inProgress: "In progress",
    },

    stats: {
      title: "Statistics",
      intro: "Best result in each category and difficulty.",
      category: "Category",
      total: "Total",
      solved: ({ n }) => `Levels solved: ${n}`,
    },

    info: {
      theory: "Theory",
      newRules: "New rules in this category",
    },

    howto: {
      title: "How to play",
      intro: "Netdoku is a deduction game. The board is a set of networks joined by routers, and several packets were on it. Use the clues to find out which cell each packet was in, and you will find the attacker.",
      basics: "Goal and how to play",
      common: "Rules common to all categories",
      clues: "Some clues you will see from the start",
      categories: "What each category adds",
      categoriesIntro: "Each category matches a part of the course and adds its own clues. During a game, the «i» button shows the theory and rules of the category.",
    },

    help: {
      title: "Help",
      intro: "All the help cards. During a game, the left panel shows only the ones each level needs.",
      categories: { basic: "How to play", rules: "Rules", clues: "Clues", icons: "Icons" },
      entries: {
        how_to_play: {
          chip: "How to play",
          title: "How to play",
          text: [
            "Place: drag a packet to the cell where you think it is, or select it in the panel and tap the cell. If you are right, it stays there; if not, it goes back to the panel and you lose one of your three lives.",
            "Notes: turn on the switch (or press A), select a packet and tap the cells where it could be. A small circle of its colour appears; tap again to remove it.",
            "Discard: right-click (or long-press) marks a cell with ✕ and clears its notes. Tap a clue to cross it out once you have used it.",
            "When you solve a level you get three stars minus one per mistake, and your best result in that difficulty is kept. The ↺ button starts another level of the same difficulty. Your progress is saved in this browser.",
          ],
          caption: "A is placed; B and C have notes; one cell is discarded.",
        },
        objective: {
          chip: "Goal",
          title: "Goal: find the attacker",
          text: [
            "The victim was alone with the attacker: there is no other packet in its network.",
            "Place every packet in its cell. When you place the last one, the attacker is revealed: it is the other packet in the victim's network.",
          ],
          caption: "V is the victim. The only other packet in its network is the attacker.",
        },
        row_column: {
          chip: "Row and column",
          title: "One packet per row and per column",
          text: [
            "Each row and each column has at most one packet. When you place one, the rest of its row and column is ruled out for the others.",
            "With as many packets as rows, each row and each column has exactly one. That is why the last packet (the victim) is found by elimination.",
          ],
          caption: "With A in row 2 and column 3, no other packet can go in the marked cells.",
        },
        adjacent: {
          chip: "«Next to»",
          title: "What «next to» means",
          text: [
            "Next to a cell are the four cells that share a side with it (up, down, left and right) and belong to the same network.",
            "Diagonals do not count. Neither does a cell in another network, even if it touches the device: the network border separates them.",
          ],
          caption: "Only the circled cells are next to the server. The one on the right is in another network.",
        },
        network_size: {
          chip: "Network size",
          title: "Prefixes, masks and network size",
          text: [
            "In a prefix a.b.c.d/n, the first n bits identify the network and the rest identify the hosts. The network has 2^(32−n) addresses: a /24 has 256; a /25, 128; a /26, 64; a /27, 32.",
            "The larger n, the fewer addresses the network has. The mask says the same with n ones: /24 is 255.255.255.0; /25, 255.255.255.128; /26, 255.255.255.192; /27, 255.255.255.224.",
            "Cells do not show the size of a network: a network with few cells can have many addresses.",
          ],
        },
        ip_network: {
          chip: "Network of an address",
          title: "Which network an address belongs to",
          text: [
            "An address belongs to the network whose first n bits match its own, where n is that network's prefix length. Networks in a level never overlap, so there is only one.",
            "Tip: every network starts at a multiple of its size. With 192.168.0.0/26, 192.168.0.64/26, 192.168.0.128/26 and 192.168.0.192/26, address 192.168.0.130 is between 128 and 191, so it belongs to 192.168.0.128/26.",
            "Watch out for addresses near the border between two networks (like .127 and .128): they cause the most mistakes.",
          ],
        },
        in_network: {
          chip: "In a network",
          title: "«It was in network X»",
          text: [
            "The packet is in some free cell of that network. Cells with devices never hold packets.",
            "Each network has its colour, its name on the board and, in the legend, its prefix (for example, 192.168.1.0/24).",
          ],
          caption: "«In the green network»: any of the circled cells.",
        },
        named_by_address: {
          chip: "Names with addresses",
          title: "Networks, devices and routers named by address",
          text: [
            "«Network 192.168.1.0/24» is named by its prefix: look it up in the legend. «The network with the fewest addresses» is the one with the longest prefix.",
            "«The network of address 192.168.1.37» makes you work out which network that address belongs to.",
            "Device addresses are not shown on the board. «Next to the web server 10.0.3.7» means the web server in that address's network.",
            "A router has one address in each network it joins: «the router with interfaces 10.0.1.1 and 10.0.2.1» is the one joining the networks of those two addresses.",
            "Addresses and masks appear in the clues without their network's colour: finding it is part of the clue.",
          ],
        },
        prefix_length: {
          chip: "Prefix length",
          title: "«It was in a /26 network»",
          text: [
            "The packet is in one of the networks with that prefix length, and there may be several. Check the legend.",
            "The clue may also give the number of addresses («a network with 64 addresses») or the mask («a network with mask 255.255.255.192»): the three forms say the same.",
          ],
          caption: "If the top-left and bottom-right networks are the only /26 ones, the packet is in one of the circled cells.",
        },
        adjacent_to_node: {
          chip: "Next to a device",
          title: "«It was next to…» a device",
          text: [
            "«Next to the web server»: in a cell next to that particular device. If there are several alike, the clue says which network it is in.",
            "«Next to a web server»: next to any of the web servers on the board. «Next to a server»: next to any server.",
          ],
          caption: "«Next to a web server»: any of the circled cells.",
        },
        unique_adjacent: {
          chip: "No other next to…",
          title: "«…and no other packet was»",
          text: [
            "«Packet A was next to the mail server, and no other packet was»: A is in one of the cells next to that device.",
            "The other cells next to it are ruled out for every other packet, the victim included, even before you know which of them holds A.",
          ],
          caption: "No other packet can be in the other cells next to the mail server.",
        },
        router: {
          chip: "Next to a router",
          title: "«It was next to the router joining X and Y»",
          text: [
            "Routers sit on the border between networks: they are the way from one network to another and belong to every network they join.",
            "Only two cells are next to a router: the one touching it in each of the two networks.",
          ],
          caption: "Only the two circled cells are next to the router, one in each network.",
        },
        spatial: {
          chip: "Row or column",
          title: "«It was in row N» or «in column N»",
          text: [
            "Rows are counted from top to bottom and columns from left to right. The numbers are in the board margin.",
            "Together with the one-packet-per-row-and-column rule, one of these clues rules out that row or column for all the others.",
          ],
          caption: "«In row 2»: any of the free cells in that row.",
        },
        icons: {
          chip: "Icons",
          title: "Board icons",
          text: [
            "Monitor: user computer (client). Rack: server; the badge shows the service: blue globe (web), purple «DNS», orange envelope (mail), green folder (files) and red triangle (multimedia).",
            "Blue circle with arrows on a border: router. Packets are the coloured circles with a letter.",
          ],
          caption: "Client, web, DNS, mail and file servers, a router and a packet.",
        },
      },
    },

    categories: {
      tablero: {
        name: "Board",
        short: "Networks, devices and routers. Reading the board is enough.",
        theory: [
          "A network is a set of devices that communicate directly at the link layer, without going through a router. Networks are bounded by routers. On the board, each coloured area is a network; the legend shows its prefix (for example, 192.168.1.0/24), which identifies it.",
          "Devices (nodes) can be end or intermediate nodes. End nodes (hosts) send and receive data; intermediate nodes, such as switches and routers, only forward it. A switch joins devices within the same network: it does not split it.",
          "Most services follow the client/server model: the client (the user computer) requests a service and the server provides it. The game has web, DNS, mail, file and multimedia servers.",
          "A router separates networks and connects them: it has one interface, with its IP address, in each network it connects. That is why on the board it sits on the border between two networks and belongs to both.",
          "What travels from one network to another through routers is a packet, the data unit of the network layer.",
        ],
        rules: ["in_network", "adjacent_to_node", "unique_adjacent", "router", "spatial"],
      },
      direccionamiento: {
        name: "Addressing",
        short: "Prefixes, masks and IP addresses: work out which network each address belongs to.",
        theory: [
          "An IPv4 address has 32 bits and is written as four decimal numbers separated by dots (192.168.1.37). It has two parts: the network and the host.",
          "The prefix /n says how many leading bits belong to the network. The mask says the same with n consecutive ones: /24 is 255.255.255.0; /26, 255.255.255.192.",
          "A /n network has 2^(32−n) addresses. The first is the network identifier and the last is the broadcast address; the rest (2^(32−n) − 2) are assigned to hosts and router interfaces.",
          "An address belongs to a network if applying the mask to it (IP AND mask) gives that network's identifier.",
          "An address block is split into subnets whose size is a power of two and which start at a multiple of their size. With VLSM (variable-length subnet masks) subnets can have different sizes.",
        ],
        rules: ["named_by_address", "network_size", "ip_network", "prefix_length"],
      },
    },

    about: {
      title: "About",
      paragraphs: [
        "Netdoku is a logic deduction game inspired by Murdoku. Instead of rooms and suspects, the board has networks, devices and routers, and you must find out where each packet was to catch the attacker.",
        "It was created for the course Redes y Servicios (Networks and Services) at the University of Málaga. The categories follow the order of the syllabus: each one matches a part of the course and can be played as soon as it has been covered in class.",
        "Its teaching goal is to practise the course concepts by reasoning with them, not just memorising them. Each clue requires interpreting a concept: what a router joins, which network an address belongs to or how many addresses a network has.",
        "The difficulty of each level has two parts: logic (which deductions are needed) and reading (which calculations are needed to understand the clues).",
        "Levels are generated automatically. Every level has a single solution that can be reached by reasoning, without guessing.",
      ],
      license: "Open source under the MIT License.",
    },

    theme: {
      label: "Theme",
      button: "Appearance: create or edit a theme",
      title: "Appearance",
      savedTheme: "Saved theme",
      custom: "Custom",
      close: "Close",
      namePlaceholder: "Theme name",
      save: "Save as theme",
      remove: "Delete theme",
      presetName: "That name belongs to a built-in theme; choose another one.",
      saved: "Saved as «{name}».",
      needName: "Type a name for the theme.",
      removed: "Deleted «{name}».",
      presets: { classic: "Classic", textures: "Textures", accessible: "Accessible", text: "Text" },
      options: {
        mode: { label: "Mode", values: { auto: "Automatic (system)", light: "Light", dark: "Dark" } },
        palette: { label: "Network colours", values: { pastel: "Pastel", vivid: "Vivid", colorblind: "Colour-blind friendly", gray: "Greys" } },
        pattern: { label: "Cell background", values: { plain: "Plain", dots: "Dots", stripes: "Stripes", tiles: "Tiles", perNetwork: "One texture per network" } },
        icons: { label: "Devices", values: { drawings: "Drawings", text: "Text (PC, Web, DNS…)", both: "Drawings with text" } },
      },
      toggles: { numbers: "Row and column numbers", netNames: "Network names on the board" },
    },
  });
})();

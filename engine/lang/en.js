// English texts for Netdoku.
(function () {
  "use strict";

  const plural = (n, one, many) => (n === 1 ? one : many);

  const NODES = {
    client: "user computer", server: "server", web: "web server", dns: "DNS server",
    mail: "mail server", storage: "file server", multimedia: "multimedia server", dhcp: "DHCP server",
  };
  const PLURAL = {
    client: "user computers", server: "servers", web: "web servers", dns: "DNS servers",
    mail: "mail servers", storage: "file servers", multimedia: "multimedia servers", dhcp: "DHCP servers",
  };
  const COUNT = { 2: "two", 3: "three" };
  const kind = (v) => v.service || v.nodeType;
  // "with no servers", "with a single web server", "with exactly two user computers".
  const countText = (v) => (v.count === 0 ? `with no ${PLURAL[kind(v)]}`
    : v.count === 1 ? `with a single ${NODES[kind(v)]}`
      : `with exactly ${COUNT[v.count] || v.count} ${PLURAL[kind(v)]}`);
  const lengthOf = (prefix) => Number(prefix.split("/")[1]);

  function clue(c, L) {
    const s = c.slots || {};
    const params = c.parameters || {};
    const p = c.packet;

    const net = (slot) => {
      const n = L.network(slot.ref);
      const size = 2 ** (32 - lengthOf(n.prefix));
      switch (slot.form) {
        case "prefix": return `network ${n.prefix}`;
        case "contents": return `the network ${countText(slot.value)}`;
        case "size_rank": return slot.value === "most" ? "the network with the most addresses" : "the network with the fewest addresses";
        case "address_count": return `the network with ${size} addresses`;
        case "usable_count": return `the network with ${size - 2} usable addresses`;
        case "mask": return `the network with mask ${L.mask(lengthOf(n.prefix))}`;
        case "first_host": return `the network whose first usable address is ${slot.value}`;
        case "last_host": return `the network whose last usable address is ${slot.value}`;
        case "broadcast": return `the network whose broadcast address is ${slot.value}`;
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
    // A row or column: by its number or by a computer or router in it.
    const line = (slot, axis) => {
      const v = slot.value || {};
      if (slot.form === "aligned_node") return `in the same ${axis} as ${node({ ref: v.node, form: v.form })}`;
      if (slot.form === "aligned_router") return `in the same ${axis} as the router ${router({ ref: v.router, form: v.form })}`;
      return `in ${axis} ${slot.ref}`;
    };
    const length = (slot) => {
      const n = slot.ref;
      switch (slot.form) {
        case "address_count": return `a network with ${2 ** (32 - n)} addresses`;
        case "usable_count": return `a network with ${2 ** (32 - n) - 2} usable addresses`;
        case "mask": return `a network with mask ${L.mask(n)}`;
        default: return `a /${n} network`;
      }
    };

    switch (c.type) {
      case "network.in_network":
        return `Packet ${p} was in ${net(s.net || { ref: params.networkId })}.`;
      case "network.prefix_length":
        return `Packet ${p} was in ${length(s.len || { ref: params.prefixLength })}.`;
      case "network.not_in_network":
        return `Packet ${p} was not in ${net(s.net || { ref: params.networkId })}.`;
      case "network.in_either_network":
        return `Packet ${p} was in ${net(s.net1 || { ref: params.networkIds[0] })} or in ${net(s.net2 || { ref: params.networkIds[1] })}.`;
      case "network.node_count":
        return `Packet ${p} was in a network ${countText(params)}.`;
      case "node.not_adjacent_to_node":
        if (params.nodeId) return `Packet ${p} was not next to ${node(s.node || { ref: params.nodeId })}.`;
        return `Packet ${p} was not next to any ${NODES[kind(params)]}.`;
      case "node.adjacent_to_node":
        if (params.nodeId) return `Packet ${p} was next to ${node(s.node || { ref: params.nodeId })}.`;
        return `Packet ${p} was next to a ${params.service ? NODES[params.service] : NODES[params.nodeType]}.`;
      case "node.unique_adjacent_to_node":
        return `Packet ${p} was next to ${node(s.node || { ref: params.nodeId })}, and no other packet was.`;
      case "router.adjacent_to_router":
        return `Packet ${p} was next to the router ${router(s.router || { ref: params.routerId })}.`;
      case "spatial.in_row":
        return `Packet ${p} was ${line(s.row || { ref: params.row }, "row")}.`;
      case "spatial.in_column":
        return `Packet ${p} was ${line(s.column || { ref: params.column }, "column")}.`;
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
    nodesPlural: PLURAL,
    nodeText: { client: "PC", web: "Web", dns: "DNS", mail: "Mail", storage: "Files", multimedia: "Media", dhcp: "DHCP" },
    clue,

    ui: {
      language: "Language",
      tagline: "A deduction game for learning computer networks",
      hook: "You run these networks and someone has tampered with a packet. Can you find the attacker before the attack spreads?",
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
      objective: ({ victim }) => `Alert! Someone has tampered with packet ${victim}. There was only one other packet in its network: the attacker. Use the clues to work out where each packet was (at most one per row and per column) and unmask the attacker before the attack spreads.`,
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
      result: ({ errors, hints }) => {
        const parts = [];
        if (errors) parts.push(`${errors} ${plural(errors, "mistake", "mistakes")}`);
        if (hints) parts.push(`${hints} ${plural(hints, "hint", "hints")}`);
        return `Solved with ${parts.join(" and ")}. Without mistakes or hints you get all three stars.`;
      },
      best: ({ n }) => `Your best result in this difficulty: ${n} ${plural(n, "star", "stars")}.`,
      unlocked: "You have unlocked the next difficulty.",
      attacker: ({ attacker, net, victim }) => `Caught! The attacker is packet ${attacker}: the only other packet in the ${net} network, where the victim ${victim} was.`,
      lost: "You have run out of lives and the attacker got away. Try another level of this difficulty.",
      newLevel: "Another level",
      nextDifficulty: "Next difficulty ›",
      backToCategory: "Back to the category",
      confirmNew: "Start another level? Your progress in this one will be lost.",
    },

    hint: {
      button: "Hint",
      title: "Hint",
      buttonTitle: "Ask for a hint: it explains the next deduction you can make. It costs a life.",
      noLives: "You can't ask for hints with only one life left.",
      unsupported: "This level doesn't support hints.",
      ask: "A hint explains the next deduction you can make, without telling you the cell. It costs a life (and therefore a star). Do you want it?",
      yes: "Yes, for one life",
      no: "Cancel",
      close: "Close the hint",
      none: "No deduction was found.",
      stepsNote: "Click a step to see on the board the cells it talks about.",
      used: "You used a hint and lose a life.",
      mark: ({ r, c }) => `Check your marks: the ✕ in row ${r}, column ${c} is wrong, because there was a packet in that cell.`,
      single: ({ packet }) => `Look at packet ${packet}: with its clues and the rows and columns already taken, it has only one possible cell left.`,
      singleAfter: ({ packet }) => `So packet ${packet} has only one possible cell left.`,
      lineRow: ({ packet, n }) => `Row ${n} must have a packet and the only one that can go there is ${packet}: ${packet} is in row ${n}.`,
      lineColumn: ({ packet, n }) => `Column ${n} must have a packet and the only one that can go there is ${packet}: ${packet} is in column ${n}.`,
      annul: ({ packet }) => `A clue of packet ${packet} says no other packet was next to that element: the cells around it (highlighted) are ruled out for the rest.`,
      oneRow: ({ packet, n }) => `Packet ${packet} can only be in row ${n}: that row is its own, so no other packet can go there.`,
      oneColumn: ({ packet, n }) => `Packet ${packet} can only be in column ${n}: that column is its own, so no other packet can go there.`,
      subsetCells: ({ packets, n }) => `Packets ${packets} can only be in these ${n} cells (highlighted), one each: no other packet can go there.`,
      subsetRows: ({ packets, lines }) => `Packets ${packets} can only be in rows ${lines}, one in each: no other packet can go in those rows.`,
      subsetColumns: ({ packets, lines }) => `Packets ${packets} can only be in columns ${lines}, one in each: no other packet can go in those columns.`,
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
      intro: "You run a set of networks joined by routers, and your systems have just raised the alarm: someone has tampered with a packet. It is the **victim**, and there was only one other packet in its network: the **attacker**. You don't know where each packet was, but the logs give you clues. Work out the position of every packet and find out where the attack came from before it spreads. Are you up to it?",
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
            "Hint: if you get stuck, the Hint button explains the next deduction you can make (or warns you if one of your ✕ is wrong), without telling you the cell. It costs a life, so you can't ask for one with your last life.",
            "When you solve a level you get three stars minus one per mistake or hint, and your best result in that difficulty is kept. The ↺ button starts another level of the same difficulty. Your progress is saved in this browser.",
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
        special_addresses: {
          chip: "Broadcast and usable",
          title: "Network identifier, broadcast and usable addresses",
          text: [
            "The first address of a network is its network identifier (the one in the prefix) and the last one is the broadcast address, used to send to every device in the network. Neither is assigned to a device.",
            "The other 2^(32−n) − 2 are usable: they go to devices and to router interfaces. A /26 has 64 addresses, 62 of them usable.",
            "The broadcast address is the identifier plus the number of addresses minus 1: in 192.168.1.64/26, 64 + 64 − 1 = 127, so the broadcast is 192.168.1.127. The first usable address is the one after the identifier (192.168.1.65) and the last one, the one before the broadcast (192.168.1.126).",
            "So «the network whose first usable address is 192.168.1.65» is the one with identifier 192.168.1.64: look it up in the legend.",
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
        negative: {
          chip: "«Was not…»",
          title: "«It was not in…» and «it was not next to…»",
          text: [
            "«It was not in network X»: the packet is in any free cell of the other networks.",
            "«It was not next to the web server»: none of the cells next to that device. «It was not next to any server»: no cell next to a server of any kind.",
            "These clues do not say where the packet is, but where it is not: they are usually useful near the end, when few cells are left.",
          ],
          caption: "«Not in the network on the right»: any of the circled cells.",
        },
        either: {
          chip: "One network or another",
          title: "«It was in network X or in network Y»",
          text: [
            "The packet is in one of the two networks, without saying which: any free cell of either one.",
            "The networks are listed in a fixed order, so the true one can be the first or the second.",
          ],
          caption: "«In the top-left network or in the bottom-right one»: any of the circled cells.",
        },
        node_count: {
          chip: "Counting devices",
          title: "«It was in a network with no servers»",
          text: [
            "Count the devices in each network. «A network with no servers» is any network without one; «a network with a single web server», any network with exactly one. The number is exact.",
            "If only one network fits the description, the clue names it that way: «the network with exactly two user computers».",
            "«Servers» includes every server, whatever its service.",
          ],
          caption: "«In a network with no servers»: the two bottom networks only have user computers.",
        },
        prefix_length: {
          chip: "Prefix length",
          title: "«It was in a /26 network»",
          text: [
            "The packet is in one of the networks with that prefix length, and there may be several. Check the legend.",
            "The clue may also give the number of addresses («a network with 64 addresses»), the number of usable addresses («a network with 62 usable addresses») or the mask («a network with mask 255.255.255.192»): they all say the same.",
            "If only one network has that length, the clue names that network: «the network with 64 addresses».",
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
          title: "«It was in row N» or «in the same row as…»",
          text: [
            "Rows are counted from top to bottom and columns from left to right. The numbers are in the board margin.",
            "«In the same row as the DNS server»: in that device's row, in any network. A router is in a row if it sits on the border between two cells of that row, and in a column if it sits on the border between two cells of that column.",
            "Together with the one-packet-per-row-and-column rule, one of these clues rules out that row or column for all the others.",
          ],
          caption: "«In the same row as the DNS server»: any of the free cells in row 2.",
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
      inicial: {
        name: "Getting started",
        short: "Networks, devices and routers. No networking knowledge required.",
        theory: [
          "A **network** is a set of devices that communicate directly with each other, without going through a **router**. The devices in your home (computer, phones, TV…) most likely form a network, and the computers in a university lab form another. On the board, each coloured area is a network: its name appears on the board and its **prefix** (for example, 192.168.1.0/24), which identifies it, in the legend.",
          "Communication is organised in **layers**, each solving one part of the problem. The **link layer** carries data from one device to another within the same network, over a cable (Ethernet) or over WiFi: that is why devices in a network are said to communicate “at the link level”. The **network layer** carries data from one network to another through routers.",
          "A **router** separates networks and, at the same time, joins them: it receives a packet from one network and forwards it to another, towards its destination. It has an **interface** (a connection with its own IP address) in each network it joins, so it belongs to all of them; that is why it sits on the border between two networks on the board. Your home router, for example, joins your network with your Internet provider's.",
          "What travels from one network to another through routers is a **packet**, the data unit of the network layer. Like an envelope, it carries the address of its **source** and that of its **destination**.",
          "**Devices** (or **nodes**) can be **end devices** or **intermediate devices**. End devices, also called **hosts** (computers, phones, servers), send and receive the data; intermediate ones (switches, WiFi access points, routers) only forward it. A **switch** joins devices within a network but does not split it: all the computers in a lab connected to its switches are still a single network.",
          "Most services follow the **client/server** model: the **client** asks for something and the **server** provides it. For example, your browser (client) asks a **web server** for a page. In the game there are user devices (clients) and web, **DNS** (they translate names such as www.uma.es into IP addresses), mail, file and multimedia servers.",
        ],
        rules: ["in_network", "negative", "either", "node_count", "adjacent_to_node", "unique_adjacent", "router", "spatial"],
      },
      direccionamiento: {
        name: "Addressing",
        short: "Prefixes, masks and IP addresses: work out which network each address belongs to.",
        theory: [
          "Every device has an **IP address**, which is like its “name” on the network: it identifies the device, and packets carry the address of their source and that of their destination. In IPv4 it is 32 bits written as four numbers from 0 to 255 separated by dots, for example **192.168.1.37**; each number is an **octet** (8 bits). Strictly speaking, the address belongs to each **interface** (each connection to a network): that is why a router has one address in each network it joins.",
          "An address has two parts: the **network** (the first bits, the same for every device in that network) and the **host** (the rest). The **prefix** /n says how many bits belong to the network: in 192.168.1.0/24, the first 24 bits (192.168.1) are the network and the last 8, the host.",
          "The **mask** says the same as the prefix, with n ones followed by zeros. /24 is **255.255.255.0**; /26 is **255.255.255.192**, because the last octet is 11000000 in binary, which is 192.",
          "A /n network has **2^(32−n) addresses**: a /24 has 256 and a /26, 64. The longer the prefix, the fewer addresses the network has. The first one is the **network identifier** (in 192.168.1.0/24, 192.168.1.0) and the last one is the **broadcast** address (192.168.1.255), used to send to every device in the network. The other 2^(32−n) − 2 are **usable**: they are assigned to devices and router interfaces (a /24 has 254). The size of a network is its number of addresses, not its cells on the board.",
          "To find the broadcast address, add the number of addresses minus 1 to the identifier. In 192.168.1.64/26 (64 addresses), 64 + 64 − 1 = 127: the broadcast is **192.168.1.127**, the first usable address is 192.168.1.65 and the last one, 192.168.1.126.",
          "An address belongs to a network if applying the mask to it (**IP AND mask**) gives that network's identifier. For example, for 192.168.1.130 with a /26 mask: 130 AND 192 = 128 (10000010 AND 11000000 = 10000000), so it belongs to **192.168.1.128/26**.",
          "An address block is split into **subnets**. Each subnet has a number of addresses that is a power of two (4, 8, 16, 32, 64, 128…) and starts at a multiple of that number. For example, a /24 can be split into four /26 subnets of 64 addresses, starting at .0, .64, .128 and .192 (multiples of 64). **Tip**: to find which /26 192.168.1.130 belongs to, look for the nearest multiple of 64 below 130, which is 128; the subnet is 192.168.1.128/26 (from .128 to .191). With prefixes shorter than /24, do the same in the octet where the prefix ends: for example, 10.0.37.5 in a /20 (blocks of 16 in the third octet) belongs to 10.0.32.0/20.",
          "With **VLSM** (variable-length subnet masks), the subnets of a block can have different sizes, depending on what each one needs: for example, a /25 (128 addresses) for a lab and a /27 (32) for an office. In a level, networks never overlap, so each address belongs to just one.",
        ],
        rules: ["named_by_address", "network_size", "ip_network", "special_addresses", "prefix_length"],
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
      university: "University of Málaga",
      credits: "Developed by Gabriel Luque with the help of Claude (Anthropic).",
      license: "Open source under the MIT License.",
      source: "Source code:",
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

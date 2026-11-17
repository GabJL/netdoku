// English texts for Netdoku.
(function () {
  "use strict";

  const plural = (n, one, many) => (n === 1 ? one : many);
  // "Classrooms and Services", "Classrooms, Services and Research".
  const join = (names) => (names.length === 1 ? names[0]
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);
  // The only public or private network in the level (privacy and label_privacy forms).
  const privacy = (v) => (v === "public" ? "public" : "private");

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

  // Training: "no router", "one router", "two routers"; row or column; origin or destination.
  const ROUTER_WORDS = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five" };
  const routers0 = (n) => (n === 0 ? "no router" : `${ROUTER_WORDS[n] || n} router${n === 1 ? "" : "s"}`);
  const axisWord = (axis) => (axis === "row" ? "row" : "column");
  const endWord = (end) => (end === "origin" ? "origin" : "destination");
  // "Classrooms or Services", "Classrooms, Services or Library".
  const orJoin = (names) => (names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`);
  // What the frame says in each route clue seen from the link layer (mac_view form).
  const MAC_FACTS = {
    "endpoint.in_origin_network": "Every device that forwards the packet puts it in a new frame with its own source MAC. If the frame was sent by the origin device itself, the packet has not crossed any router yet: it is still in its origin network.",
    "endpoint.in_destination_network": "A frame can only be addressed directly to a device in its own network. If it goes to the destination device, the packet is already in its destination network.",
    "route.last_router": "Each router forwards the packet in a new frame with its own source MAC: whoever sent the frame is the last router the packet crossed.",
    "route.next_router": "The frame is addressed to the MAC of the next hop, which is the next router on the route.",
    default: "A frame only travels inside one network: its source MAC is that of the last device that forwarded the packet, and its destination MAC that of the next hop.",
  };

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
        case "privacy": return `the ${privacy(slot.value)} network`;
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
        case "label_privacy": return `the ${label} in the ${privacy(slot.value)} network`;
        default: return `the ${label} in the ${L.network(n.network).name} network`;
      }
    };
    // A router joins two to four networks.
    const router = (slot) => {
      if (slot.form === "interfaces") return `with interfaces ${join(slot.value)}`;
      if (slot.form === "privacy") return `of the ${privacy(slot.value)} network`;
      return `joining ${join(L.router(slot.ref).connectedNetworks
        .map((id) => L.network(id))
        .map((n) => (slot.form === "networks_prefix" ? n.prefix : n.name)))}`;
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

    // Route and TTL clues: from the frame (MAC) or with the current TTL.
    const mac = s.view && s.view.form === "mac_view";
    const ttlValue = s.ttl && s.ttl.form === "ttl_value";
    const ttl0 = L.ttl(p);
    const WORDS = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five" };
    const routers = (n) => `${WORDS[n] || n} router${n === 1 ? "" : "s"}`;
    // Clues about two packets: the second one.
    const q = (c.packets || [])[1];

    switch (c.type) {
      case "endpoint.origin":
      case "endpoint.destination": {
        const slot = s.node || { ref: params.nodeId };
        const origin = c.type === "endpoint.origin";
        if (slot.form === "ip") return `The ${origin ? "source" : "destination"} IP of packet ${p} was ${slot.value}.`;
        return origin ? `Packet ${p} had been sent by ${node(slot)}.` : `Packet ${p} was addressed to ${node(slot)}.`;
      }
      case "endpoint.origin_class":
        return `Packet ${p} had been sent by a ${NODES[kind(params)]}.`;
      case "endpoint.destination_class":
        return `Packet ${p} was addressed to a ${NODES[kind(params)]}.`;
      case "route.first_router": {
        const r = router(s.router || { ref: params.routerId });
        return mac ? `When it left its source device, the frame carrying packet ${p} was addressed to the router ${r}.`
          : `The first router on the route of packet ${p} was the router ${r}, the default gateway of its source device.`;
      }
      case "route.final_router": {
        const r = router(s.router || { ref: params.routerId });
        return mac ? `In its destination network, packet ${p} arrived in a frame sent by the router ${r}.`
          : `The last router on the route of packet ${p} was the router ${r}.`;
      }
      case "relation.same_network":
        return `Packets ${p} and ${q} were in the same network.`;
      case "relation.routers_between":
        return params.count === 1 ? `The networks of packets ${p} and ${q} were neighbours: a router joined them.`
          : `Going from the network of packet ${p} to that of packet ${q} meant crossing at least ${routers(params.count)}.`;
      case "relation.more_addresses_network":
        return `Packet ${p} was in a network with more addresses than that of packet ${q}.`;
      case "relation.more_routers_crossed":
        return `Packet ${p} had crossed more routers than packet ${q}.`;
      case "relation.higher_ttl":
        return `At that moment, packet ${p} had a higher TTL than packet ${q}.`;
      case "relation.closer_to_destination":
        return `Packet ${p} had fewer routers left than packet ${q} to reach its destination network.`;
      case "relation.same_origin":
        return `Packets ${p} and ${q} had left from the same network.`;
      case "relation.same_destination":
        return `Packets ${p} and ${q} were going to the same network.`;
      case "endpoint.in_origin_network":
        return mac ? `The frame carrying packet ${p} had been sent by its own source device.`
          : `Packet ${p} had not left its source network yet.`;
      case "endpoint.in_destination_network":
        return mac ? `The frame carrying packet ${p} was addressed directly to its destination device.`
          : `Packet ${p} had already reached its destination network.`;
      case "route.in_transit_network":
        return `Packet ${p} was passing through a transit network.`;
      case "route.last_router": {
        const r = router(s.router || { ref: params.routerId });
        return mac ? `The frame carrying packet ${p} had been sent by the router ${r}.`
          : `The last router packet ${p} had crossed was the router ${r}.`;
      }
      case "route.next_router": {
        const r = router(s.router || { ref: params.routerId });
        return mac ? `The frame carrying packet ${p} was addressed to the router ${r}.`
          : `The next router packet ${p} was going to cross was the router ${r}.`;
      }
      case "ttl.routers_crossed": {
        const n = params.count;
        if (ttlValue) return `Packet ${p} had TTL ${ttl0 - n}.`;
        return n === 0 ? `Packet ${p} had not crossed any router.` : `Packet ${p} had crossed exactly ${routers(n)}.`;
      }
      case "ttl.routers_left":
        return `Packet ${p} had ${routers(params.count)} left to reach its destination network.`;
      case "ttl.routers_crossed_range": {
        if (params.min !== undefined) {
          const n = params.min;
          if (ttlValue) return n === 1 ? `The TTL of packet ${p} was already lower than the initial one.` : `The TTL of packet ${p} was at most ${ttl0 - n}.`;
          return n === 1 ? `Packet ${p} had already crossed some router.` : `Packet ${p} had crossed at least ${routers(n)}.`;
        }
        const n = params.max;
        if (ttlValue) return `The TTL of packet ${p} was at least ${ttl0 - n}.`;
        return `Packet ${p} had crossed at most ${routers(n)}.`;
      }
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
      office: "Office", research: "Research", backbone: "Backbone",
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
        test: "Tests",
        train: "Train",
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
      routerName: ({ names }) => `Router between ${join(names)}`,
      routeNote: "Each packet's card shows its source, its destination and its initial TTL: it was in a network on its route that its TTL let it reach.",
      hiddenNote: "If a card does not show a packet's source or destination, work it out from the clues: each possible network gives a different route.",
      unknownEndpoint: "unknown",
      origin: "Source",
      destination: "Destination",
      ttlInitial: "Initial TTL",
      endpoint: ({ label, net }) => `${label} in ${net}`,
      broadcastTo: ({ address }) => `broadcast (${address})`,
      originTag: "source",
      destinationTag: "destination",
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
      singleRoute: ({ packet }) => `Look at packet ${packet}: with its route, its TTL, its clues and the rows and columns already taken, it has only one possible cell left.`,
      lineRow: ({ packet, n }) => `Row ${n} must have a packet and the only one that can go there is ${packet}: ${packet} is in row ${n}.`,
      lineColumn: ({ packet, n }) => `Column ${n} must have a packet and the only one that can go there is ${packet}: ${packet} is in column ${n}.`,
      annul: ({ packet }) => `A clue of packet ${packet} says no other packet was next to that element: the cells around it (highlighted) are ruled out for the rest.`,
      // "it does not go through Development", "it does not go through Classrooms or Services".
      route: ({ packet, route, networks }) => {
        const where = networks.length === 1 ? networks[0] : `${networks.slice(0, -1).join(", ")} or ${networks[networks.length - 1]}`;
        const path = route.length === 1 ? `Packet ${packet} does not leave ${route[0]}`
          : `Packet ${packet} takes the path with the fewest routers: ${route.join(" → ")}`;
        return `${path}. It can only be in a network on its route, and it does not go through ${where}: the highlighted cells are ruled out for ${packet}.`;
      },
      // "it does not reach Research", "it does not reach Library or Services".
      ttl: ({ packet, ttl, networks }) => {
        const words = { 1: "one router", 2: "two routers", 3: "three routers", 4: "four routers", 5: "five routers" };
        const crossed = ttl <= 1 ? "it cannot have crossed any router on its route"
          : `it has crossed at most ${words[ttl - 1] || `${ttl - 1} routers`} on its route`;
        const where = networks.length === 1 ? networks[0] : `${networks.slice(0, -1).join(", ")} or ${networks[networks.length - 1]}`;
        return `The initial TTL of packet ${packet} is ${ttl}. Each router takes 1 off it, and the one that brings it to 0 drops it: ${crossed}, so it does not reach ${where}. The highlighted cells are ruled out for ${packet}.`;
      },
      relationFixed: ({ packet, other }) => `A clue links packets ${packet} and ${other}. With what you already know about ${other}, the highlighted cells do not fit the clue: they are ruled out for ${packet}.`,
      relationOpen: ({ packet, other }) => `A clue links packets ${packet} and ${other}. Although ${other} still has several possibilities, none of them fits the clue with ${packet} in the highlighted cells: they are ruled out for ${packet}.`,
      relationEnds: ({ packet, other }) => `A clue links packets ${packet} and ${other}. With what you already know about ${other}, rule out some of the possible networks of the hidden source or destination of ${packet}.`,
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

    // Temporary test view.
    test: {
      title: "Tests",
      intro: "Fixed levels from the game's pools to check the rules and texts: each clue subtype appears on at least three boards, and each naming form and each addressing plan on at least one. Play them, tick the ones that are right and send the list of seeds. They do not count for the statistics.",
      askKey: "Key for the test view:",
      wrongKey: "Wrong key.",
      loadError: "The list of test levels (levels/test.json) could not be read.",
      count: ({ done, total }) => `Validated: ${done} of ${total}.`,
      copy: "Copy",
      copied: "Seeds copied.",
      seed: "Seed {seed}",
      detail: ({ logic, reading, clues }) => `Logic ${logic}, interpretation ${reading} · ${clues} ${clues === 1 ? "clue" : "clues"}`,
      subtypes: "Subtypes",
      forms: "Forms",
      plan: "Plan",
      features: "With",
      feature: {
        broadcast: "broadcast packet",
        transit: "transit network",
        shortTtl: "TTL that does not reach the destination",
      },
      play: "Play",
      validated: "Validated",
      playing: "Test level {seed}: it does not count for the statistics.",
      gameTitle: "{category} · {tier} · seed {seed}",
      mark: "Mark as validated",
      unmark: "Remove the validated mark",
      back: "Back to the tests",
    },

    // Training: exercises for each clue and each rule (see generator/netdoku_gen/training.py).
    // Reasons explain why a cell is not valid; facts explain how the step is solved. They get
    // networks, devices and routers already by name.
    train: {
      title: "Train",
      intro: "Short exercises to learn each clue and each rule: a small board with one packet to decide and, when needed, others already placed. Tap the cells the exercise asks for; if you pick one that is not valid, you will see why. Mistakes do not count.",
      categories: { rules: "Game rules", inicial: "Getting started", direccionamiento: "Addressing", encaminamiento: "Routing" },
      categoryIntro: {
        rules: "What holds in every level: at most one packet per row and per column, and which cells are next to a device.",
        inicial: "The clues of the Getting started category: networks, devices, routers, rows and columns.",
        direccionamiento: "Networks and devices named by their addresses: prefixes, masks, sizes, special addresses and private networks.",
        encaminamiento: "Routes and TTL: where each packet goes, how far it gets, the frames of each hop and hidden endpoints.",
      },
      progress: ({ done, total }) => `✓ ${done}/${total}`,
      openHelp: "Open the help card",
      practice: "Practise",
      practiceTitle: "Exercises for this card",
      empty: "There are no exercises yet.",
      loadError: "Could not read the list of exercises (levels/train/index.json).",
      gameTitle: "Train · {variant}",
      meta: "{category} · {variant}",
      objective: "Training: there is no victim and no lives. Tap the cells the exercise asks for; mistakes do not count.",
      task: "Exercise",
      stepOf: "Step {n} of {total}",
      ask: {
        possible: "Tap the cells where packet {packet} can be.",
        impossible: "Tap the cells where packet {packet} cannot be: they get a ✕.",
        annul: "Tap the cells where no other packet can go any more: they get a ✕.",
      },
      given: "The dashed circles are the possible cells of packet {packet}.",
      count: ({ n, total }) => `${n} of ${total} so far.`,
      explanation: "Explanation",
      explain: "Show explanation",
      reveal: "Show solution",
      next: "Next step",
      stepDone: "Well done! You found them all.",
      finished: "Exercise complete!",
      extraOk: "That works too: this cell is ruled out, although you did not need to mark it.",
      extraNote: "The cells with a dashed border are ruled out too, although you did not need to mark them: they share a row or a column with every possible cell of the packet.",
      wrong: "That cell is not valid.",
      done: "Exercise complete.",
      doneRevealed: "Exercise finished with the solution. Try another one to complete it on your own.",
      another: "Another exercise",
      nextVariant: "Next in the list",
      back: "Back to the list",
      variants: {
        "rules.row_column.annul": "A placed packet: its row and column",
        "rules.row_column.free": "Free rows and columns",
        "rules.row_column.last": "The last free cell",
        "rules.row_column.forced": "A forced row or column",
        "rules.adjacent": "Next to a device: the network border",
        "inicial.in_network": "In a network",
        "inicial.not_in_network": "Not in a network",
        "inicial.not_adjacent.node": "Not next to a device",
        "inicial.not_adjacent.class": "Not next to any device of a kind",
        "inicial.either": "In one network or another",
        "inicial.node_count": "In a network with so many devices",
        "inicial.contents": "The network with so many devices",
        "inicial.adjacent.node": "Next to a device",
        "inicial.adjacent.service": "Next to a server of a service",
        "inicial.adjacent.class": "Next to a device of a kind",
        "inicial.unique_adjacent": "Next to a device, and no other packet",
        "inicial.router": "Next to a router",
        "inicial.row": "In a row",
        "inicial.column": "In a column",
        "inicial.aligned_node": "In the row or column of a device",
        "inicial.aligned_router": "In the row or column of a router",
        "inicial.same_network": "In the same network as another packet",
        "inicial.routers_between": "Routers between the networks of two packets",
        "dir.prefix": "A network by its prefix",
        "dir.label_prefix": "A device of the network with a prefix",
        "dir.networks_prefix": "A router by the prefixes it joins",
        "dir.size_rank": "The network with the most or fewest addresses",
        "dir.address_count": "The network with N addresses",
        "dir.mask": "The network with a mask",
        "dir.prefix_length": "In a /N network",
        "dir.length_count": "In a network with N addresses",
        "dir.length_usable": "In a network with N usable addresses",
        "dir.length_mask": "In a network with a mask",
        "dir.ip_member": "The network of an address",
        "dir.node_ip": "A device by its IP",
        "dir.interfaces": "A router by its interfaces",
        "dir.first_host": "The first usable address",
        "dir.last_host": "The last usable address",
        "dir.broadcast": "The broadcast address",
        "dir.usable_count": "The network with N usable addresses",
        "dir.privacy": "The public or private network",
        "dir.label_privacy": "A device of the public or private network",
        "dir.more_addresses": "A network with more addresses than another packet's",
        "enc.route": "The route of a packet",
        "enc.short_ttl": "A TTL that does not reach the destination",
        "enc.broadcast": "A broadcast packet",
        "enc.in_origin": "Still in its origin network",
        "enc.in_destination": "Already in its destination network",
        "enc.in_transit": "In a transit network",
        "enc.last_router": "The last router crossed",
        "enc.next_router": "The next router",
        "enc.mac_origin": "A frame sent by the origin device",
        "enc.mac_last": "A frame sent by a router",
        "enc.mac_next": "A frame addressed to a router",
        "enc.mac_destination": "A frame addressed to the destination device",
        "enc.crossed": "Routers crossed",
        "enc.ttl_value": "The current TTL",
        "enc.left": "Routers left",
        "enc.range_min": "At least N routers",
        "enc.range_max": "At most N routers",
        "enc.range_ttl": "A TTL of at most or at least",
        "enc.corner": "A router in a corner",
        "enc.hidden_origin": "Hidden origin: who sent it",
        "enc.hidden_class": "Hidden destination: what kind of device",
        "enc.first_router": "Hidden origin: the first router",
        "enc.final_router": "Hidden destination: the last router",
        "enc.more_routers": "More routers than another packet",
        "enc.higher_ttl": "A higher TTL than another packet",
        "enc.closer": "Closer to its destination than another packet",
      },
      reasons: {
        rowTaken: ({ r, packet }) => `Packet ${packet} is already in row ${r}, and there is room for only one packet per row.`,
        columnTaken: ({ c, packet }) => `Packet ${packet} is already in column ${c}, and there is room for only one packet per column.`,
        notLine: ({ packet, r, c }) => `This cell is neither in row ${r} nor in column ${c} of packet ${packet}: another packet could still go here.`,
        forced: ({ packet, other, axis, line, otherLine }) => `Packet ${other} can only go in ${axisWord(axis)} ${otherLine}, so ${packet} must go in the other free ${axisWord(axis)}, ${line}.`,
        canBe: ({ packet }) => `Packet ${packet} can be in this cell.`,
        open: () => "This cell is not ruled out: another packet could still go here.",
        offRoute: ({ packet, net }) => `${net} is not on the route of packet ${packet}.`,
        noTtl: ({ packet, net, k, ttl }) => `To reach ${net}, packet ${packet} would have to cross ${routers0(k)}, and with initial TTL ${ttl} it can only cross ${routers0(ttl - 1)}: each router subtracts 1 and drops it when it reaches 0.`,
        hiddenOff: ({ packet, net, end }) => `Wherever its ${endWord(end)} is, the route of packet ${packet} does not reach ${net}.`,
        hiddenNo: ({ packet, net, end, tags }) => `With the clue, its ${endWord(end)} network is ${orJoin(tags)}, and then the route of packet ${packet} does not reach ${net}.`,
        notNext: ({ node, nodeNet }) => `This cell is not next to the ${node} in ${nodeNet}.`,
        notNextBorder: ({ node, net }) => `This cell touches the ${node}, but it belongs to another network (${net}): next to a device only counts the cells of its own network.`,
        notNextClass: ({ cls }) => `This cell is not next to any ${cls}.`,
        next: ({ node, nodeNet }) => `This cell is next to the ${node} in ${nodeNet}.`,
        nextClass: ({ cls, node, nodeNet }) => `This cell is next to the ${node} in ${nodeNet}${cls === node ? "" : `, which is a ${cls}`}.`,
        notRouter: ({ router }) => `This cell does not touch the router joining ${join(router)}.`,
        row: ({ r }) => `This cell is in row ${r}.`,
        column: ({ c }) => `This cell is in column ${c}.`,
        net: ({ net, prefix }) => `This cell belongs to ${net} (${prefix}).`,
        netCount: ({ net, clsKey, count }) => `This cell belongs to ${net}, a network ${countText({ nodeType: clsKey, count })}.`,
        netLength: ({ net, prefix, len }) => `This cell belongs to ${net} (${prefix}), a /${len} network.`,
        routeAt: ({ packet, net, k, ttl }) => `In ${net}, packet ${packet} would have crossed ${routers0(k)} and would carry TTL ${ttl}.`,
        routeLast: ({ packet, net, router }) => (router ? `In ${net}, the last router packet ${packet} would have crossed is the one joining ${join(router)}.`
          : `In ${net}, packet ${packet} would not have crossed any router yet.`),
        routeNext: ({ packet, net, router }) => (router ? `In ${net}, the next router of packet ${packet} would be the one joining ${join(router)}.`
          : `In ${net}, packet ${packet} would already be in its destination network: no routers left.`),
        routeLeft: ({ packet, net, left }) => `In ${net}, packet ${packet} would have ${routers0(left)} left to reach its destination network.`,
        relNet: ({ packet, other, net, otherNet }) => `Here packet ${packet} would be in ${net}, and ${other} is in ${otherNet}.`,
        relDistance: ({ packet, other, net, otherNet, d }) => (d === 0 ? `Here packet ${packet} would be in ${net}, the same network as ${other}.`
          : `Going from ${net} to ${otherNet}, the network of packet ${other}, means crossing at least ${routers0(d)}.`),
        relSize: ({ packet, other, net, size, otherNet, otherSize }) => (net === otherNet ? `Here packet ${packet} would be in ${net}, the same network as ${other} (${size} addresses).`
          : `Here packet ${packet} would be in ${net}, with ${size} addresses, and the network of packet ${other}, ${otherNet}, has ${otherSize}.`),
        relCrossed: ({ packet, other, k, otherK }) => `Here packet ${packet} would have crossed ${routers0(k)}, and ${other} has crossed ${routers0(otherK)}.`,
        relTtl: ({ packet, other, ttl, otherTtl }) => `Here packet ${packet} would carry TTL ${ttl}, and ${other} carries TTL ${otherTtl}.`,
        relLeft: ({ packet, other, l, otherL }) => `Here packet ${packet} would have ${routers0(l)} left, and ${other} has ${routers0(otherL)} left.`,
      },
      facts: {
        route: ({ packet, route, ttl, reach, full }) => `Route of packet ${packet}: ${route.join(" → ")}. With initial TTL ${ttl} it can cross ${routers0(ttl - 1)}: ${full ? "it reaches its destination network" : `it only gets as far as ${reach}`}.`,
        broadcastRoute: ({ packet, net, address }) => `Packet ${packet} goes to the broadcast address ${address}: it does not leave ${net}, because routers do not forward broadcasts.`,
        hiddenAlt: ({ end, net, route, reach, full }) => `If its ${endWord(end)} was in ${net}: route ${route.join(" → ")}; ${full ? "it reaches its destination network" : `with its TTL it only gets as far as ${reach}`}.`,
        nets: ({ packet, nets }) => `So packet ${packet} can be in any free cell of ${join(nets)}.`,
        lines: ({ packet, other, r, c }) => `Also, ${packet} cannot go in row ${r} or column ${c}, which belong to packet ${other}.`,
        adjacentRule: () => "Next to a device: the cells that share a side with its cell (not diagonally) and belong to the same network.",
        routerRule: ({ router, corner }) => `The router joining ${join(router)} sits between ${corner ? "four cells (in a corner)" : "two cells"}: being next to it means being in one of them.`,
        transit: ({ net }) => `The transit network is ${net}: it has no devices, it only joins routers.`,
        endpointNode: ({ packet, end, node, nodeNet }) => `The ${endWord(end)} of packet ${packet} was the ${node} in ${nodeNet}: its route ${end === "origin" ? "starts" : "ends"} in ${nodeNet}.`,
        endpointClass: ({ packet, end, cls, nets }) => `The ${endWord(end)} of packet ${packet} was a ${cls}: its network is ${orJoin(nets)}.`,
        endRouter: ({ end, router, tags }) => `The ${end === "origin" ? "first" : "last"} router of the route is the one joining ${join(router)} only if the ${endWord(end)} is in ${orJoin(tags)}.`,
        pNet: ({ other, net }) => `Packet ${other} is in ${net}.`,
        pDistance: ({ other, net, d }) => `Packet ${other} is in ${net}: the other network must be at least ${routers0(d)} away from it.`,
        pSize: ({ other, net, size, prefix }) => `Packet ${other} is in ${net} (${prefix}), which has ${size} addresses.`,
        pCrossed: ({ other, k }) => `Packet ${other} has crossed ${routers0(k)}.`,
        pTtl: ({ other, ttl0, k, ttl }) => `Packet ${other} left with TTL ${ttl0} and has crossed ${routers0(k)}: it now carries TTL ${ttl}.`,
        pLeft: ({ other, left }) => `Packet ${other} has ${routers0(left)} left to reach its destination network.`,
        relAt: ({ other, otherNet, d, nets }) => `Networks ${routers0(d)} away from ${otherNet}, the network of packet ${other}: ${join(nets)}.`,
        relValues: ({ packet, what, nets, values }) => {
          const pairs = nets.map((n, i) => `${n}, ${values[i]}`).join("; ");
          if (what === "size") return `Addresses of each network: ${pairs}.`;
          if (what === "crossed") return `Routers packet ${packet} would have crossed in each network of its route: ${pairs}.`;
          if (what === "ttl") return `TTL packet ${packet} would carry in each network of its route: ${pairs}.`;
          return `Routers packet ${packet} would have left in each network of its route: ${pairs}.`;
        },
        annulUnique: ({ node, nodeNet }) => `"No other packet was": no other packet can be in a cell next to the ${node} in ${nodeNet}.`,
        annulLine: ({ packet, axis, line }) => `All the possible cells of packet ${packet} are in ${axisWord(axis)} ${line}: that ${axisWord(axis)} will be its own, and no other packet can go in it.`,
        rowColumn: ({ packet, r, c }) => `There is at most one packet in each row and each column: with ${packet} in row ${r} and column ${c}, no other packet can go in them.`,
        freeLines: ({ packet, rows, cols }) => `Free rows: ${join(rows.map(String))}. Free columns: ${join(cols.map(String))}. Packet ${packet} must go in a free cell where they cross.`,
        forcedLine: ({ packet, other, axis, line, otherLine }) => `Two free ${axisWord(axis)}s are left for two packets. Because of its clue, ${other} can only go in ${axisWord(axis)} ${otherLine}, so ${axisWord(axis)} ${line} is for ${packet}.`,
        fPrefix: ({ prefix, net }) => `Network ${prefix} is ${net}.`,
        fSizeRank: ({ value, net, prefix, size }) => `The network with the ${value === "most" ? "most" : "fewest"} addresses is ${net} (${prefix}: ${size} addresses). Its size comes from the prefix, 2^(32 − length), not from the number of cells.`,
        fAddressCount: ({ net, prefix, len, size }) => `A /${len} network has 2^(32 − ${len}) = ${size} addresses: it is ${net} (${prefix}).`,
        fUsableCount: ({ net, prefix, len, size }) => `A /${len} network has ${size} addresses; without the network and broadcast addresses, ${size - 2} are usable: it is ${net} (${prefix}).`,
        fMask: ({ net, prefix, len, mask }) => `Mask ${mask} has ${len} bits set: it is the /${len} network, ${net} (${prefix}).`,
        fPrivacy: ({ value, net, prefix }) => `${net} (${prefix}) is the only ${privacy(value)} network. The private ones are those in 10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16.`,
        fContents: ({ net, clsKey, count }) => `${net} is the only network ${countText({ nodeType: clsKey, count })}.`,
        fFirstHost: ({ address, net, prefix, id, broadcast }) => `Network ${prefix} goes from ${id} (network address) to ${broadcast} (broadcast); its first usable address, ${address}, comes right after the network address. It is ${net}.`,
        fLastHost: ({ address, net, prefix, id, broadcast }) => `Network ${prefix} goes from ${id} (network address) to ${broadcast} (broadcast); its last usable address, ${address}, comes right before the broadcast address. It is ${net}.`,
        fBroadcast: ({ address, net, prefix, id }) => `The broadcast address is the last one in the network: ${address} is that of ${prefix} (from ${id} to ${address}), ${net}.`,
        fIpMember: ({ address, net, prefix, id, broadcast }) => `${address} lies between ${id} and ${broadcast}: it belongs to ${prefix}, which is ${net}.`,
        fNodePrefix: ({ prefix, net }) => `Network ${prefix} is ${net}.`,
        fNodeIp: ({ address, net, prefix, node, id, broadcast }) => `${address} lies between ${id} and ${broadcast}: it belongs to ${prefix} (${net}), so it is the ${node} of that network.`,
        fNodePrivacy: ({ value, net, prefix }) => `${net} (${prefix}) is the only ${privacy(value)} network. The private ones are those in 10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16.`,
        fRouterPrefixes: ({ prefixes, nets }) => `${join(prefixes)} are ${join(nets)}.`,
        fRouterIps: ({ addresses, prefixes, nets }) => `Interfaces ${join(addresses)} belong to ${join(prefixes)}: the router joins ${join(nets)}.`,
        fRouterPrivacy: ({ net, prefix, value }) => `${net} (${prefix}) is the only ${privacy(value)} network, and it has a single router.`,
        fLength: ({ len, size, mask, nets }) => `/${len}: mask ${mask}, ${size} addresses (${size - 2} usable). /${len} networks: ${join(nets)}.`,
        fAligned: ({ axis, line, node, nodeNet, router }) => (node ? `The ${node} in ${nodeNet} is in ${axisWord(axis)} ${line}.`
          : `The router joining ${join(router)} is in ${axisWord(axis)} ${line}.`),
        fMac: ({ type }) => MAC_FACTS[type] || MAC_FACTS.default,
        fTtlValue: ({ packet, ttl0, ttl, k }) => `Packet ${packet} left with TTL ${ttl0} and carries TTL ${ttl}: it has crossed ${ttl0} − ${ttl} = ${k} ${plural(k, "router", "routers")}.`,
        fTtlMax: ({ ttl0, bound, k }) => `With initial TTL ${ttl0}, a TTL of at most ${bound} means it has crossed at least ${ttl0} − ${bound} = ${k} ${plural(k, "router", "routers")}.`,
        fTtlMin: ({ ttl0, bound, k }) => `With initial TTL ${ttl0}, a TTL of at least ${bound} means it has crossed at most ${ttl0} − ${bound} = ${k} ${plural(k, "router", "routers")}.`,
      },
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
        privacy: {
          chip: "Private and public",
          title: "Private and public networks",
          text: [
            "There are three private address blocks: 10.0.0.0/8 (every address starting with 10), 172.16.0.0/12 (from 172.16.0.0 to 172.31.255.255) and 192.168.0.0/16 (every address starting with 192.168). Every other address in the levels is public.",
            "«The public network» is the only network in the level with a public prefix, and «the private network», the only one with a private prefix: check the legend. «The web server in the public network» is the web server of that network, and «the router of the public network», its only router.",
            "Watch out for 172: 172.20.0.0/16 is private, but 172.15.0.0/16 and 172.32.0.0/16 are public.",
            "Private addresses are used in internal networks, like your home's or a company's. To reach the Internet, the router translates the private address into a public one (NAT).",
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
            "Only two cells are next to a router on a border: the one touching it in each of the two networks.",
          ],
          caption: "Only the two circled cells are next to the router, one in each network.",
        },
        corner_router: {
          chip: "Router in a corner",
          title: "Routers joining three or four networks",
          text: [
            "A router can join three or four networks: it has an interface, with its address, in each of them. On the board it sits on the corner where those networks meet.",
            "The cells next to a router in a corner are the four cells touching that corner (except those with a device).",
            "A router in a corner is not in a single row or column, so row and column clues never use it.",
          ],
          caption: "The router joins the three networks; the four circled cells are next to it.",
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
        relation: {
          chip: "Between two packets",
          title: "Clues about two packets",
          text: [
            "Some clues talk about two packets at once and appear on both cards. «Packets A and B were in the same network»: once you know which network one of them is in, the other one is in that same network.",
            "«The networks of packets A and B were neighbours: a router joined them»: they are in two different networks joined by a router. «Going from the network of A to that of B meant crossing at least two routers»: count the routers on the shortest path between the two networks.",
            "«Packet A was in a network with more addresses than that of packet B» compares the size of the two networks: their number of addresses, not their cells.",
            "These clues rule out cells even before either packet is placed: if B can only be in large networks, A cannot be in the smallest one.",
          ],
          caption: "«A and B were in the same network»: with A placed, B is in one of the circled cells, outside A's row and column.",
        },
        route_trace: {
          chip: "Routes",
          title: "Source, destination and route of a packet",
          text: [
            "In this category, each packet's card shows its source, its destination and its initial TTL. Hover over the card (or select the packet) to see its source and destination devices on the board.",
            "The packet's route is the shortest path, the one with the fewest routers, between the network of its source and that of its destination. In every level that path is unique: follow it from router to router.",
            "The packet was in a free cell of a network on its route: its source network, its destination network or one in between, as long as its TTL lets it get there (see the TTL card).",
            "A transit network (Backbone) has no devices: it only joins routers. Packets may pass through it, but they never start or end there.",
            "If the destination is the broadcast of its network, the packet goes to every device in that network and no router forwards it: it stays in its source network.",
          ],
          caption: "From the user computer on the left to the web server on the right with initial TTL 2: it can only cross one router, so it is in one of the circled cells.",
        },
        ttl: {
          chip: "TTL",
          title: "TTL: time to live",
          text: [
            "Each packet leaves its source with an initial TTL (in the game, between 2 and 6). Each router it crosses subtracts 1; switches and access points do not change it.",
            "Current TTL = initial TTL − routers crossed. A packet with TTL 1 is still alive, but the next router will bring it to 0, drop it and notify the source with an ICMP message.",
            "So a packet with initial TTL 3 can only have crossed 0, 1 or 2 routers, even if its route has more: if its TTL does not reach, it will never get to its destination.",
          ],
        },
        frames: {
          chip: "Frames and MAC",
          title: "The frame carrying a packet",
          text: [
            "Inside each network, the packet travels in a link-layer frame, which goes from one device or router to the next one in that same network. Each of them is identified by its MAC address.",
            "The packet's source and destination IP addresses do not change along the way. The frame's MAC addresses change in each network: it is sent by the previous device or router and addressed to the next hop.",
            "So «the frame had been sent by its own source device» means the packet had not left its source network yet; «the frame was addressed to the router X», that the next router on its route was X; «the frame had been sent by the router X», that the last router it had crossed was X; and «the frame was addressed directly to its destination device», that it was already in its destination network.",
          ],
        },
        hidden_endpoint: {
          chip: "Hidden source or destination",
          title: "Unknown source or destination",
          text: [
            "In some levels, a packet's card does not show its source or its destination: it says «unknown». You have to work it out from the clues, and each possible network gives a different route and, therefore, different cells.",
            "«Packet A had been sent by the web server in the Classrooms network» or «The source IP of packet A was 10.0.1.7» tell you which device it is; «it had been sent by a DNS server», only its kind: any of the DNS servers on the board.",
            "«The first router on the route of packet A was the router X, the default gateway of its source device»: the source is in one of the networks X joins, and the route leaves it through X. «The last router on its route was X»: the destination is in a network X joins, and the route reaches it through X.",
            "Once the level is solved, the card shows the missing device.",
          ],
        },
        route_position: {
          chip: "Source, destination or transit",
          title: "«It had not left its source network yet»",
          text: [
            "«It had not left its source network yet»: the packet is in the network of its source device; it has not crossed any router.",
            "«It had already reached its destination network»: it is in the network of its destination device.",
            "«It was passing through a transit network»: it is in the network with no devices on its route.",
          ],
          caption: "«It had not left its source network yet»: any of the circled cells.",
        },
        route_router: {
          chip: "Last or next router",
          title: "«The last router it had crossed…»",
          text: [
            "«The last router it had crossed was the router joining X and Y»: the packet had just gone through that router, so it is in whichever of the two networks it was heading to. You need to know which way it is going.",
            "«The next router it was going to cross was…»: it is in whichever of the two networks it came from. This holds even if its TTL will not let it cross that router.",
          ],
          caption: "«The last router it had crossed was the one on the left»: it goes from left to right, so it is in the middle network.",
        },
        ttl_count: {
          chip: "Routers crossed",
          title: "«It had crossed exactly two routers»",
          text: [
            "Count the routers on its route from the source network: after crossing two, the packet is in the third network of its route.",
            "«It had two routers left to reach its destination network»: count backwards from the destination network.",
            "«It had already crossed some router», «at least two», «at most one»: the packet is in any network on its route that meets the condition.",
            "«It had TTL 2»: subtract it from the initial TTL on its card to know how many routers it has crossed (with initial TTL 4, two). «Its TTL was at most 2» is the same as «it had crossed at least two routers».",
          ],
          caption: "«It had already crossed some router»: any network on its route except the source one.",
        },
        route_relation: {
          chip: "Routes of two packets",
          title: "Clues comparing two packets",
          text: [
            "«Packet A had crossed more routers than packet B»: count the routers each one has crossed since its source. «At that moment, packet A had a higher TTL than packet B»: compare their current TTLs (initial TTL − routers crossed).",
            "«Packet A had fewer routers left than packet B to reach its destination network»: compare how many routers each one still has to cross.",
            "«Packets A and B had left from the same network» or «were going to the same network»: they appear when the source or the destination of one of them is hidden.",
            "Like the other clues about two packets, they appear on both cards and rule out cells even before either packet is placed.",
          ],
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
        rules: ["in_network", "negative", "either", "node_count", "adjacent_to_node", "unique_adjacent", "router", "spatial", "relation"],
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
          "There are three **private address** blocks: **10.0.0.0/8**, **172.16.0.0/12** (from 172.16.0.0 to 172.31.255.255) and **192.168.0.0/16**. They can be used in any internal network, like your home's or a company's, but not on the Internet. All other addresses are **public** and unique across the whole Internet. For a device with a private address to reach the Internet, the router translates its address into a public one: that is **NAT**.",
        ],
        rules: ["named_by_address", "network_size", "ip_network", "special_addresses", "prefix_length", "privacy"],
      },
      encaminamiento: {
        name: "Routing",
        short: "Routes and TTL: follow each packet from router to router, from its source to its destination.",
        theory: [
          "When a packet's source and destination are in different networks, the packet has to cross **routers**. Each router decides which network to forward it on to bring it closer to its destination: that is **routing**. The sequence of networks and routers it goes through is its **route**.",
          "In the game, the route is the **shortest path**, the one crossing the fewest routers, between the source network and the destination network, as the RIP routing protocol does by counting hops. In every level of this category that path is unique.",
          "The packet's source and destination IP addresses do not change along the way. What changes in each network is the link-layer **frame** carrying it: it goes from the previous device or router to the **next hop**, identified by their **MAC** addresses. The next hop's MAC address is found with **ARP**.",
          "The **TTL** (time to live) is a field of the IP header. The source gives it an initial value and each router subtracts 1. If a router brings it to 0, it drops the packet and notifies the source with an **ICMP** message (that is how tracert works). It keeps a packet from looping forever if there is a routing error.",
          "Current TTL = initial TTL − routers crossed. A packet with initial TTL 3 can only have crossed two routers: if its route has more, it will not reach its destination. Switches and access points do not count, because they do not look at the IP header.",
          "A router can join more than two networks, with an interface in each. On the board, a router joining three or four networks sits on the corner where they meet.",
          "The router in its network to which a device sends the packets addressed to other networks is its **default gateway**: it is the first router on the route of those packets.",
          "A **transit network** has no devices: it only joins routers, like the links between the routers of a company or a provider. Packets cross it, but never start or end there.",
          "**Broadcast** (for example, the DHCP request of a device that has no address yet) goes to every device in a network, but routers do not forward it: a broadcast packet does not leave its source network.",
        ],
        rules: ["route_trace", "ttl", "frames", "corner_router", "hidden_endpoint", "route_position", "route_router", "ttl_count", "route_relation"],
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

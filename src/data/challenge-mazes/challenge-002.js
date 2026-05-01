export default {
  "gates": [
    {
      "from": {
        "x": 3,
        "y": 2
      },
      "id": "3,1|3,2",
      "to": {
        "x": 3,
        "y": 1
      }
    }
  ],
  "height": 3,
  "id": "challenge-002",
  "lights": [
    {
      "cell": {
        "x": 0,
        "y": 0
      },
      "side": "west"
    },
    {
      "cell": {
        "x": 3,
        "y": 0
      },
      "side": "north"
    },
    {
      "cell": {
        "x": 1,
        "y": 2
      },
      "side": "south"
    },
    {
      "cell": {
        "x": 2,
        "y": 1
      },
      "side": "north"
    }
  ],
  "opening": {
    "cell": {
      "x": 2,
      "y": 2
    },
    "side": "south"
  },
  "openEdges": [
    {
      "from": {
        "x": 0,
        "y": 0
      },
      "to": {
        "x": 1,
        "y": 0
      }
    },
    {
      "from": {
        "x": 0,
        "y": 0
      },
      "to": {
        "x": 0,
        "y": 1
      }
    },
    {
      "from": {
        "x": 1,
        "y": 0
      },
      "to": {
        "x": 2,
        "y": 0
      }
    },
    {
      "from": {
        "x": 2,
        "y": 0
      },
      "to": {
        "x": 3,
        "y": 0
      }
    },
    {
      "from": {
        "x": 3,
        "y": 0
      },
      "to": {
        "x": 3,
        "y": 1
      }
    },
    {
      "from": {
        "x": 0,
        "y": 1
      },
      "to": {
        "x": 0,
        "y": 2
      }
    },
    {
      "from": {
        "x": 1,
        "y": 1
      },
      "to": {
        "x": 2,
        "y": 1
      }
    },
    {
      "from": {
        "x": 1,
        "y": 1
      },
      "to": {
        "x": 1,
        "y": 2
      }
    },
    {
      "from": {
        "x": 2,
        "y": 1
      },
      "to": {
        "x": 2,
        "y": 2
      }
    },
    {
      "from": {
        "x": 3,
        "y": 1
      },
      "to": {
        "x": 3,
        "y": 2
      }
    },
    {
      "from": {
        "x": 0,
        "y": 2
      },
      "to": {
        "x": 1,
        "y": 2
      }
    },
    {
      "from": {
        "x": 2,
        "y": 2
      },
      "to": {
        "x": 3,
        "y": 2
      }
    }
  ],
  "seed": 401372,
  "width": 4,
  "contentProfile": {
    "gateCount": 1,
    "monsterTypes": [
      "spider",
      "werewolf"
    ],
    "swordCount": 0
  },
  "generatedByChallengeTool": true,
  "items": [],
  "monsters": [
    {
      "cell": {
        "x": 3,
        "y": 0
      },
      "hand": "left",
      "type": "spider"
    },
    {
      "cell": {
        "x": 1,
        "y": 2
      },
      "type": "werewolf",
      "direction": "south"
    }
  ],
  "sword": null,
  "trophy": {
    "cell": {
      "x": 0,
      "y": 0
    }
  },
  "visibility": {
    "cells": {
      "0,0": [
        "0,0",
        "0,1",
        "0,2",
        "1,0",
        "1,2",
        "2,0",
        "3,0",
        "3,1"
      ],
      "1,0": [
        "0,0",
        "0,1",
        "0,2",
        "1,0",
        "2,0",
        "3,0",
        "3,1"
      ],
      "2,0": [
        "0,0",
        "0,1",
        "1,0",
        "2,0",
        "3,0",
        "3,1",
        "3,2"
      ],
      "3,0": [
        "0,0",
        "0,1",
        "1,0",
        "2,0",
        "2,2",
        "3,0",
        "3,1",
        "3,2"
      ],
      "0,1": [
        "0,0",
        "0,1",
        "0,2",
        "1,0",
        "1,2",
        "2,0",
        "3,0"
      ],
      "1,1": [
        "0,2",
        "1,1",
        "1,2",
        "2,1",
        "2,2",
        "3,2"
      ],
      "2,1": [
        "0,2",
        "1,1",
        "1,2",
        "2,1",
        "2,2",
        "3,2"
      ],
      "3,1": [
        "0,0",
        "1,0",
        "2,0",
        "2,2",
        "3,0",
        "3,1",
        "3,2"
      ],
      "0,2": [
        "0,0",
        "0,1",
        "0,2",
        "1,0",
        "1,1",
        "1,2",
        "2,1"
      ],
      "1,2": [
        "0,0",
        "0,1",
        "0,2",
        "1,1",
        "1,2",
        "2,1"
      ],
      "2,2": [
        "1,1",
        "2,1",
        "2,2",
        "3,0",
        "3,1",
        "3,2"
      ],
      "3,2": [
        "1,1",
        "2,0",
        "2,1",
        "2,2",
        "3,0",
        "3,1",
        "3,2"
      ]
    },
    "version": 1
  },
  "solution": {
    "actions": [
      "rotate-right",
      "move-forward",
      "rotate-right",
      "rotate-right",
      "move-forward",
      "rotate-right",
      "rotate-right",
      "move-forward",
      "rotate-left",
      "move-forward",
      "move-forward",
      "rotate-left",
      "move-forward",
      "move-forward",
      "move-forward",
      "rotate-right",
      "rotate-right",
      "move-forward",
      "move-forward",
      "move-forward",
      "rotate-right",
      "move-forward",
      "move-forward",
      "rotate-right",
      "move-forward",
      "rotate-left",
      "move-forward"
    ],
    "moveCount": 15,
    "observedCellCount": 12,
    "visibilityLimited": true
  },
  "name": "Challenge 02: 4x3, 0 minotaurs, 1 spider, 1 wolf, 0 swords, 1 gate",
  "description": "4x3, 0 minotaurs, 1 spider, 1 wolf, 0 swords, 1 gate"
}

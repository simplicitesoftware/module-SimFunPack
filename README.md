![Logo](https://platform.simplicite.io/logos/standard/logo250.png)

SimFunPack
==========

A light-hearted add-on module for [Simplicité](https://www.simplicite.io/) that
hides three fully playable games ("easter eggs") inside the platform UI.

| Game            | Where it lives            | How to launch it                                         |
|-----------------|---------------------------|----------------------------------------------------------|
| Space Invaders  | Login (logon) page        | Click the Simplicité **logo** above the sign-in form     |
| SimpliChess     | Any authenticated screen  | Type **`gambit`** in the global search field             |
| 2048            | Any authenticated screen  | Type **`2^11`** in the global search field (2^11 = 2048) |

Enabling the easter eggs
------------------------

All three games are gated by the `SIM_EASTER_EGGS` system parameter (type `LFL`),
shipped with this module:

```json
{
  "invaders": "devmode",
  "gambit":   "devmode",
  "2048":     "devmode"
}
```

Each entry enables one game:

| Value       | Effect                                                              |
|-------------|---------------------------------------------------------------------|
| `"devmode"` | Active only when the front-end runs in **developer mode** (default) |
| `true`      | Always active, for every user                                       |
| `false`     | Disabled                                                            |

Edit the parameter value (System parameters &rarr; `SIM_EASTER_EGGS`) to turn a
game on or off. Changes take effect on the next UI reload.

The games
---------

### Space Invaders &mdash; the logon logo

On the **login page**, click the Simplicité logo displayed above the sign-in
form. A Space Invaders game starts, played on top of the login screen (the form
is the "death star" to destroy). It runs before authentication,
and keeps your best score in the browser (`localStorage`, key `logon_best_score`).

- Use arrow keys to fly (direction and speed) and the space bar to fire.
- "Esc" or reload the page to leave.

### SimpliChess &mdash; global search `gambit`

Enter **`gambit`** in the UI global (quick) search field. The chessboard opens
in a dedicated work-area tab ("Chess") when the splitter is enabled, otherwise
in a side dialog.

- Play against the built-in engine or against another connected user.
- The current position is stored per user in the `GAME_CHESS` system parameter,
  so an unfinished game is restored the next time you open it.
- Multiplayer moves are relayed by the **`SimChess`** server script: when a
  player moves, their `GAME_CHESS` value is copied to the opponent's user
  parameter and a Server-Sent Event (`ServerSideEvent.pushObject`) refreshes the
  opponent's board in real time.
- The board UI, chess rules engine and piece images are bundled in the
  `SIM_CHESSBOARD` resource set (loaded on first use).

### 2048 &mdash; global search `2^11`

Enter **`2^11`** (i.e. 2048) in the UI global search field. The grid opens 
in a work-area tab or a side dialog. Move the tiles with the arrow keys or by
swiping. The game state is saved per user in the `GAME_2048` system parameter and
restored on reopen. Reaching 2048 lets you keep going for the next power of two.

Module contents
---------------

| Type            | Code               | Purpose                                        |
|-----------------|--------------------|-----------------------------------------------|
| System param    | `SIM_EASTER_EGGS`  | Enables / disables each game                   |
| Disposition res.| `SIM_INVADERS`     | Space Invaders game (JS)                       |
| Server script   | `SimChess`         | Relays chess moves to the opponent over SSE   |
| Disposition res.| `SIM_CHESS_GAME`   | SimpliChess game + engine (JS)                 |
| Disposition res.| `SIM_CHESS_STYLES` | SimpliChess styles (LESS/CSS)                  |
| Disposition res.| `SIM_CHESSBOARD`   | Chessboard UI, rules engine, piece images (ZIP) |
| Disposition res.| `SIM_2048_GAME`    | 2048 game (JS)                                 |
| Disposition res.| `SIM_2048_STYLES`  | 2048 styles (LESS/CSS)                         |

All UI resources are attached to the `responsive5` disposition.

Build
-----

See [BUILD.md](BUILD.md). In short:

``` text
mvn clean package
```

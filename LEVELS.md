 "+ Name" indicates the name of a level, and its description follows.
 Treat North/East/South/West as not absolute, but relative directions within the context of one level's description. "North" means "The direction from which the level is entered" (or an arbitrary direction, in the case of the Entrance level) and is always the player's starting direction. 
 If a room is specified as being XxY tiles, X is in the relative East-West direction and Y is in the relative North-South direction
 If player starting direction is not specified, assume relative North.
 If the player starting position is adjacent to an edge left undefined, assume this is the shared edge with the preceding level.
 
 For some levels I will draw an ASCII map. The map depicts the cells and the edges between them. For example, this is 2x2 cells surrounded by walls on the outside:
 
  q q
 q# #q
 
 q# #q
  q q
  
ASCII legend:
# empty cell
1 player start position (assume starting direction is north unless indicated otherwise)
m minotaur
s spider
w werewolf
d sword
t trophy
a altar
h throne
q wall
f<>^v wall with torch (f means there should be a torch facing all adjacent defined cells; otherwise <>^v indicates the wall side with a troch)
p wall with painting decal (i'll indicate which one in the description)
g gate
o door

+ Entrance
 
 f d f
q# # #q

q# # #q

q# 1 #q
 q q q

Door leads to Hallway 1-1.
 
+ Hallway 1-1
This is the introduction to the Minotaur. It is intended that the player must approach the minotaur before turning and heading into the exit.

       d
      f#q 
 q q q   q q q q 
q# # # # # # # mf
   f q q q q q q
q1q

+ Hallway 1-2
This is the introduction to juking the Minotaur. It is intended that the player loop around the minotaur to escape.

   d
  fmf
     q q
  q#q# #q
  
  q# # #f
 q   q q
q# #f
   q
q1q
 
Door leads to Hallway 1-3.
This is the introduction to gates.

+ Hallway 1-3

   d
  fmf

  q#q
     q q q
  q#q# # #q
       q
  q# #g# #f
 q   q q q
q# #f
   q
q1q

Door leads to Hallway 1-4
This is the introduction to the sword.

+ Hallway 1-4
         d
        fmf
        
        q#q
 q q q q   q
fd # # # # f
 q q q q   q
        q# #q
         t
          q1q

Door leads to Hallway 1-5
This is the introduction to the altar.
        
+ Hallway 1-5

 d f
q# aq
     q q
q# # # tf
   q q q
q1q

Door does not open until altar is lit.
Door leads to Chamber 1
 
+ Chamber 1
Chamber 1 is 3 tiles wide.
The left side of Chamber 1 connects to challenge-028 (nearest) and Maze 031. The right side of Chamber 1 connects to challenge-059 (nearest) and challenge-036.
The chamber's length should be the minimum required to fit these connections without them touching any other levels or each other.
Next to the cell leading into the door of each maze should be that maze's altar.
The center-north edge of the chamber should be a door. This door should only open when all four altars are completed.
The door should lead to Chamber 2.
Place torches on each wall next to a door.

- werewolf-tutorial
- 43 soooo many spiders
- 98
- 40 gate party
- 95 is similar, and features just 1 were 1 spider, but is a little bullshit
- 100 is impressively tricky for its simplicity (2 mino 1 wolf)



+ Chamber 2
The left side of Chamber 2 connects to Maze werewolf-tutorial (nearest), challenge-098, and challenge-095 (furthest). The right side of Chamber 2 connects to challenge-043 (nearest), challenge-040, and challenge-100.
The chamber's length should be the minimum required to fit these connections without them touching any other levels or each other.
Next to the cell leading into the door of each maze should be that maze's altar.
The center-north edge of the chamber should be a door. This door should only open when all four altars are completed.
The door should lead to the Throne Room.
Place torches on each wall next to a door.

+ Throne Room

 q f q f q
f# # a # #f

q# m # m #q

f# # t # #f

q# # # # #q
 
fm # # # mf

q# # # # #q

fm # # # mf

q# # # # #q

fm # # # mf

q# # # # #q
 q q   q q 
    q#q
    
    q1q 
    
After the animation for lighting the altar in the throne room, fade to a black screen that looks like the intro screen except the subtitle is "Thank you for playing." and below that, a link to https://x.com/dgant and below that, the table with the credits

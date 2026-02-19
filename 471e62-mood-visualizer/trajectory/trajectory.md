
# MoodMorph - Development Trajectory
## Starting Point

The `repository_before` folder was completely empty. No code, no dependencies, nothing. Just a basic `package.json` that would fail when you tried to run tests.

The task was to build a React app from scratch that:
1. Takes user mood input
2. Converts it to an animated shape
3. Saves it to a gallery
4. Uses LocalStorage for persistence

## What I Built

### The Core Problem

The tricky part was making sure the same mood always produces the same shape. If someone types "happy" twice, they should see the exact same shape both times. This is important for testing and makes the app feel consistent.

### My Solution

I created a function called `moodToShape()` that works like this:

1. Take the mood text (e.g., "happy and excited")
2. Hash it to get a number (this is deterministic - same text = same number)
3. Use that number to pick properties:
   - Shape type (circle, triangle, square, etc.)
   - Colors (based on sentiment - happy = yellow, sad = black)
   - Size (between 80-200 pixels)
   - Animation type (rotate, pulse, bounce, etc.)
   - Speed (1-10)

The key is using modulo arithmetic. For example:
- `seed % 5` always gives a number 0-4, which maps to one of 5 shapes
- This guarantees the shape is always valid (requirement #4)

### Why This Approach

I tried a few things first:
- Random numbers? No - can't test that, and same mood would give different shapes
- Simple mapping? Too predictable, not interesting
- Hash-based? Perfect - deterministic but varied

The hash approach means "happy" always gives the same number, which always picks the same shape. But different moods get different numbers, so they look different.

## What Changed from Before

**Before:** Empty repository, nothing works

**After:** Complete React app with:
- Home page where you type your mood
- Shape viewer that shows the animated shape
- Gallery page showing all saved moods
- LocalStorage that saves everything
- Canvas animations that look smooth

## Testing Strategy

I wrote 66 tests total. Here's why:

### Unit Tests (Core Logic)

I tested the `moodToShape()` function heavily because it's the heart of the app:
- Does "happy" always give the same result? Yes
- Does "happy" give different result than "sad"? Yes
- What if someone types 200 characters? Still works
- What if they type just spaces? Shows error
- Do 100 random moods all produce valid shapes? Yes (proves requirement #4)

I also tested the storage functions:
- Can we save a mood? Yes
- Can we load it back? Yes
- What if the data is corrupted? Clears it and starts fresh
- Can we delete moods? Yes

### Component Tests

I tested each React component:
- Does the input form work? Yes
- Does it show an error when empty? Yes (requirement #3)
- Does the canvas render? Yes
- Does the gallery display saved moods? Yes

### Integration Tests

These test the full user flow:
- User types mood → clicks generate → sees shape → saves it → sees it in gallery
- Everything works together

## Evaluation Setup

The evaluation script (`evaluation.py`) does this:

1. Runs tests on `repository_before` - should fail (nothing there)
2. Runs tests on `repository_after` - should pass (everything works)
3. Generates a report showing the comparison

Success means all tests in `repository_after` pass.

## Technical Choices

**TypeScript:** Helps catch bugs before runtime. The shape properties have types, so I can't accidentally use wrong values.

**Canvas instead of SVG:** The requirement said canvas, and it's better for animations anyway. More control over rendering.

**Tailwind CSS:** Fast to style things. No need to write custom CSS for every little thing.

**Jest for testing:** Standard for React apps. Works well with TypeScript.

**LocalStorage:** Simple, no backend needed. Just save JSON and load it back.

## Challenges I Faced

1. **Making shapes always valid:** Solved with modulo arithmetic - can't go out of bounds
2. **Canvas animations:** Had to learn requestAnimationFrame and cleanup properly
3. **LocalStorage errors:** What if it's full? What if data is corrupted? Added error handling
4. **Deterministic but varied:** Hash function gives variety while staying consistent

## What Works Now

- Type any mood, get an animated shape
- Same mood = same shape (always)
- Save moods to gallery
- Gallery persists across page reloads
- All 4 requirements met
- All 66 tests passing

## What Could Be Better (Future Work)

- Delete individual moods (currently can only clear all)
- Search/filter in gallery
- Export shapes as images
- More animation types
- Dark mode

But these weren't in the requirements, so I kept it simple and focused.

"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Tetromino shapes
const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]]
};

const COLORS = {
  I: '#00f0f0',
  O: '#f0f000',
  T: '#a000f0',
  S: '#00f000',
  Z: '#f00000',
  J: '#0000f0',
  L: '#f0a000'
};

type ShapeType = keyof typeof SHAPES;
type PowerUpType = 'bomb' | 'slow' | 'clear' | 'ghost';

interface PowerUp {
  type: PowerUpType;
  x: number;
  y: number;
  active: boolean;
}

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

export default function Home() {
  const [board, setBoard] = useState<(string | null)[][]>(
    Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(null))
  );
  const [currentPiece, setCurrentPiece] = useState<{
    shape: number[][];
    type: ShapeType;
    x: number;
    y: number;
  } | null>(null);
  const [nextPiece, setNextPiece] = useState<ShapeType | null>(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [activePowerUp, setActivePowerUp] = useState<PowerUpType | null>(null);
  const [combo, setCombo] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [ghostMode, setGhostMode] = useState(false);

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const moveDownRef = useRef<() => void>(() => {});

  const getRandomShape = useCallback((): ShapeType => {
    const shapes = Object.keys(SHAPES) as ShapeType[];
    return shapes[Math.floor(Math.random() * shapes.length)];
  }, []);

  const createNewPiece = useCallback((type?: ShapeType) => {
    const shapeType = type || getRandomShape();
    return {
      shape: SHAPES[shapeType],
      type: shapeType,
      x: Math.floor(BOARD_WIDTH / 2) - Math.floor(SHAPES[shapeType][0].length / 2),
      y: 0
    };
  }, [getRandomShape]);

  const checkCollision = useCallback((piece: typeof currentPiece, offsetX = 0, offsetY = 0) => {
    if (!piece) return false;

    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const newX = piece.x + x + offsetX;
          const newY = piece.y + y + offsetY;

          if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
            return true;
          }

          if (newY >= 0 && board[newY][newX]) {
            return true;
          }
        }
      }
    }
    return false;
  }, [board]);

  const rotatePiece = useCallback((piece: typeof currentPiece) => {
    if (!piece) return piece;
    const rotated = piece.shape[0].map((_, i) =>
      piece.shape.map(row => row[i]).reverse()
    );
    return { ...piece, shape: rotated };
  }, []);

  const mergePiece = useCallback(() => {
    if (!currentPiece) return;

    const newBoard = board.map(row => [...row]);
    for (let y = 0; y < currentPiece.shape.length; y++) {
      for (let x = 0; x < currentPiece.shape[y].length; x++) {
        if (currentPiece.shape[y][x]) {
          const boardY = currentPiece.y + y;
          const boardX = currentPiece.x + x;
          if (boardY >= 0 && boardY < BOARD_HEIGHT) {
            newBoard[boardY][boardX] = currentPiece.type;
          }
        }
      }
    }
    setBoard(newBoard);
  }, [currentPiece, board]);

  const clearLines = useCallback(() => {
    let linesCleared = 0;
    const newBoard = board.filter(row => {
      const isFull = row.every(cell => cell !== null);
      if (isFull) linesCleared++;
      return !isFull;
    });

    while (newBoard.length < BOARD_HEIGHT) {
      newBoard.unshift(Array(BOARD_WIDTH).fill(null));
    }

    if (linesCleared > 0) {
      setBoard(newBoard);
      setLines(prev => prev + linesCleared);

      const newCombo = combo + 1;
      setCombo(newCombo);

      const baseScore = [0, 100, 300, 500, 800][linesCleared] || 800;
      const comboBonus = newCombo * 50;
      const levelBonus = level * 10;
      setScore(prev => prev + baseScore + comboBonus + levelBonus);

      // Chance to spawn power-up
      if (Math.random() < 0.3) {
        const powerUpTypes: PowerUpType[] = ['bomb', 'slow', 'clear', 'ghost'];
        const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
        setPowerUps(prev => [...prev, {
          type: randomType,
          x: Math.floor(Math.random() * BOARD_WIDTH),
          y: 0,
          active: true
        }]);
      }
    } else {
      setCombo(0);
    }

    return linesCleared;
  }, [board, combo, level]);

  const moveDown = useCallback(() => {
    if (!currentPiece || paused || gameOver) return;

    if (!checkCollision(currentPiece, 0, 1)) {
      setCurrentPiece(prev => prev ? { ...prev, y: prev.y + 1 } : null);
    } else {
      mergePiece();
      const cleared = clearLines();

      const next = nextPiece || getRandomShape();
      const newPiece = createNewPiece(next);

      if (checkCollision(newPiece)) {
        setGameOver(true);
        if (score > highScore) {
          setHighScore(score);
        }
      } else {
        setCurrentPiece(newPiece);
        setNextPiece(getRandomShape());
      }
    }
  }, [currentPiece, paused, gameOver, checkCollision, mergePiece, clearLines, nextPiece, getRandomShape, createNewPiece, score, highScore]);

  moveDownRef.current = moveDown;

  const moveLeft = useCallback(() => {
    if (!currentPiece || paused) return;
    if (!checkCollision(currentPiece, -1, 0)) {
      setCurrentPiece(prev => prev ? { ...prev, x: prev.x - 1 } : null);
    }
  }, [currentPiece, paused, checkCollision]);

  const moveRight = useCallback(() => {
    if (!currentPiece || paused) return;
    if (!checkCollision(currentPiece, 1, 0)) {
      setCurrentPiece(prev => prev ? { ...prev, x: prev.x + 1 } : null);
    }
  }, [currentPiece, paused, checkCollision]);

  const rotate = useCallback(() => {
    if (!currentPiece || paused) return;
    const rotated = rotatePiece(currentPiece);
    if (!checkCollision(rotated)) {
      setCurrentPiece(rotated);
    }
  }, [currentPiece, paused, rotatePiece, checkCollision]);

  const hardDrop = useCallback(() => {
    if (!currentPiece || paused) return;
    let dropDistance = 0;
    while (!checkCollision(currentPiece, 0, dropDistance + 1)) {
      dropDistance++;
    }
    setCurrentPiece(prev => prev ? { ...prev, y: prev.y + dropDistance } : null);
    setScore(prev => prev + dropDistance * 2);
    setTimeout(() => moveDownRef.current(), 50);
  }, [currentPiece, paused, checkCollision]);

  const usePowerUp = useCallback((type: PowerUpType) => {
    if (activePowerUp) return;

    setActivePowerUp(type);

    switch (type) {
      case 'bomb':
        const newBoard = board.map(row => [...row]);
        for (let y = BOARD_HEIGHT - 3; y < BOARD_HEIGHT; y++) {
          for (let x = 0; x < BOARD_WIDTH; x++) {
            newBoard[y][x] = null;
          }
        }
        setBoard(newBoard);
        setScore(prev => prev + 200);
        break;
      case 'clear':
        setBoard(Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(null)));
        setScore(prev => prev + 500);
        break;
      case 'ghost':
        setGhostMode(true);
        setTimeout(() => setGhostMode(false), 10000);
        break;
      case 'slow':
        break;
    }

    setTimeout(() => setActivePowerUp(null), type === 'slow' ? 15000 : 1000);
  }, [activePowerUp, board]);

  const startGame = useCallback(() => {
    setBoard(Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(null)));
    const firstShape = getRandomShape();
    setCurrentPiece(createNewPiece(firstShape));
    setNextPiece(getRandomShape());
    setScore(0);
    setLevel(1);
    setLines(0);
    setGameOver(false);
    setPaused(false);
    setGameStarted(true);
    setCombo(0);
    setPowerUps([]);
    setActivePowerUp(null);
    setGhostMode(false);
  }, [getRandomShape, createNewPiece]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!gameStarted || gameOver) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          moveLeft();
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveRight();
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveDown();
          break;
        case 'ArrowUp':
        case ' ':
          e.preventDefault();
          rotate();
          break;
        case 'Shift':
          e.preventDefault();
          hardDrop();
          break;
        case 'p':
        case 'P':
          setPaused(prev => !prev);
          break;
        case '1':
        case '2':
        case '3':
        case '4':
          const powerUpIndex = parseInt(e.key) - 1;
          if (powerUps[powerUpIndex]?.active) {
            usePowerUp(powerUps[powerUpIndex].type);
            setPowerUps(prev => prev.map((p, i) => i === powerUpIndex ? { ...p, active: false } : p));
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameStarted, gameOver, moveLeft, moveRight, moveDown, rotate, hardDrop, powerUps, usePowerUp]);

  useEffect(() => {
    if (gameStarted && !gameOver && !paused) {
      const speed = activePowerUp === 'slow' ? 1000 : Math.max(100, 800 - (level - 1) * 50);
      gameLoopRef.current = setInterval(() => {
        moveDownRef.current();
      }, speed);
    }

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [gameStarted, gameOver, paused, level, activePowerUp]);

  useEffect(() => {
    const newLevel = Math.floor(lines / 10) + 1;
    if (newLevel > level) {
      setLevel(newLevel);
      setScore(prev => prev + newLevel * 100);
    }
  }, [lines, level]);

  const getGhostPosition = useCallback(() => {
    if (!currentPiece) return null;
    let ghostY = currentPiece.y;
    while (!checkCollision({ ...currentPiece, y: ghostY + 1 })) {
      ghostY++;
    }
    return ghostY;
  }, [currentPiece, checkCollision]);

  const renderBoard = () => {
    const displayBoard = board.map(row => [...row]);
    const ghostY = getGhostPosition();

    if (currentPiece && ghostY !== null && ghostY > currentPiece.y) {
      for (let y = 0; y < currentPiece.shape.length; y++) {
        for (let x = 0; x < currentPiece.shape[y].length; x++) {
          if (currentPiece.shape[y][x]) {
            const boardY = ghostY + y;
            const boardX = currentPiece.x + x;
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              if (!displayBoard[boardY][boardX]) {
                displayBoard[boardY][boardX] = 'ghost' as any;
              }
            }
          }
        }
      }
    }

    if (currentPiece) {
      for (let y = 0; y < currentPiece.shape.length; y++) {
        for (let x = 0; x < currentPiece.shape[y].length; x++) {
          if (currentPiece.shape[y][x]) {
            const boardY = currentPiece.y + y;
            const boardX = currentPiece.x + x;
            if (boardY >= 0 && boardY < BOARD_HEIGHT) {
              displayBoard[boardY][boardX] = currentPiece.type;
            }
          }
        }
      }
    }

    return displayBoard.map((row, y) => (
      <div key={y} className="flex">
        {row.map((cell, x) => (
          <motion.div
            key={`${y}-${x}`}
            className={`w-7 h-7 border border-slate-700/30 ${
              cell === 'ghost' ? 'opacity-30' : ''
            }`}
            style={{
              backgroundColor: cell && cell !== 'ghost' ? COLORS[cell as ShapeType] : 'rgba(15, 23, 42, 0.5)',
              boxShadow: cell && cell !== 'ghost' ? `0 0 10px ${COLORS[cell as ShapeType]}40` : 'none',
            }}
            animate={cell && cell !== 'ghost' ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.2 }}
          />
        ))}
      </div>
    ));
  };

  const renderNextPiece = () => {
    if (!nextPiece) return null;
    const shape = SHAPES[nextPiece];
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-slate-800/50 rounded-lg border border-purple-500/30">
        {shape.map((row, y) => (
          <div key={y} className="flex">
            {row.map((cell, x) => (
              <div
                key={`${y}-${x}`}
                className="w-6 h-6 border border-slate-700/30"
                style={{
                  backgroundColor: cell ? COLORS[nextPiece] : 'transparent',
                  boxShadow: cell ? `0 0 8px ${COLORS[nextPiece]}40` : 'none',
                }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />

      <div className="relative z-10 flex gap-8">
        <div className="space-y-4">
          <motion.div
            className="bg-slate-800/80 backdrop-blur-sm p-4 rounded-lg border border-purple-500/50 shadow-2xl"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-center mb-4">
              <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 text-glow">
                TETRIS ULTRA
              </h1>
              <p className="text-purple-300 text-sm mt-1">Next-Gen Edition</p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center mb-4">
              <div className="bg-slate-900/60 p-3 rounded border border-cyan-500/30">
                <div className="text-cyan-400 text-xs font-semibold">SCORE</div>
                <div className="text-2xl font-bold text-white">{score}</div>
              </div>
              <div className="bg-slate-900/60 p-3 rounded border border-green-500/30">
                <div className="text-green-400 text-xs font-semibold">LEVEL</div>
                <div className="text-2xl font-bold text-white">{level}</div>
              </div>
              <div className="bg-slate-900/60 p-3 rounded border border-yellow-500/30">
                <div className="text-yellow-400 text-xs font-semibold">LINES</div>
                <div className="text-2xl font-bold text-white">{lines}</div>
              </div>
            </div>

            {combo > 1 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-center mb-3 text-orange-400 font-bold text-lg glow-strong"
              >
                {combo}x COMBO! 🔥
              </motion.div>
            )}

            <div className="border-2 border-purple-500/50 rounded-lg overflow-hidden shadow-2xl bg-slate-900/40">
              {renderBoard()}
            </div>

            {!gameStarted && (
              <motion.button
                onClick={startGame}
                className="w-full mt-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg glow-strong"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                START GAME
              </motion.button>
            )}

            {gameOver && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center rounded-lg"
              >
                <div className="text-center p-8">
                  <h2 className="text-4xl font-bold text-red-500 mb-4 text-glow">GAME OVER</h2>
                  <p className="text-2xl text-white mb-2">Final Score: {score}</p>
                  <p className="text-xl text-purple-300 mb-6">High Score: {highScore}</p>
                  <button
                    onClick={startGame}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 px-8 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg glow"
                  >
                    PLAY AGAIN
                  </button>
                </div>
              </motion.div>
            )}

            {paused && gameStarted && !gameOver && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center rounded-lg"
              >
                <div className="text-center">
                  <h2 className="text-4xl font-bold text-yellow-400 mb-4 text-glow">PAUSED</h2>
                  <p className="text-white">Press P to resume</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        <div className="space-y-4">
          <motion.div
            className="bg-slate-800/80 backdrop-blur-sm p-4 rounded-lg border border-purple-500/50 shadow-xl"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h3 className="text-purple-300 font-semibold mb-3 text-center">NEXT</h3>
            {renderNextPiece()}
          </motion.div>

          <motion.div
            className="bg-slate-800/80 backdrop-blur-sm p-4 rounded-lg border border-purple-500/50 shadow-xl"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-purple-300 font-semibold mb-3">POWER-UPS</h3>
            <div className="space-y-2">
              {powerUps.filter(p => p.active).slice(0, 4).map((powerUp, i) => (
                <motion.button
                  key={i}
                  onClick={() => {
                    usePowerUp(powerUp.type);
                    setPowerUps(prev => prev.map((p, idx) => idx === i ? { ...p, active: false } : p));
                  }}
                  disabled={!!activePowerUp}
                  className={`w-full p-2 rounded text-sm font-semibold transition-all ${
                    powerUp.type === 'bomb' ? 'bg-red-600 hover:bg-red-700' :
                    powerUp.type === 'slow' ? 'bg-blue-600 hover:bg-blue-700' :
                    powerUp.type === 'clear' ? 'bg-green-600 hover:bg-green-700' :
                    'bg-purple-600 hover:bg-purple-700'
                  } ${activePowerUp ? 'opacity-50 cursor-not-allowed' : ''}`}
                  whileHover={!activePowerUp ? { scale: 1.05 } : {}}
                  whileTap={!activePowerUp ? { scale: 0.95 } : {}}
                >
                  [{i + 1}] {powerUp.type.toUpperCase()} {
                    powerUp.type === 'bomb' ? '💣' :
                    powerUp.type === 'slow' ? '⏰' :
                    powerUp.type === 'clear' ? '✨' : '👻'
                  }
                </motion.button>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="bg-slate-800/80 backdrop-blur-sm p-4 rounded-lg border border-purple-500/50 shadow-xl text-xs"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-purple-300 font-semibold mb-3">CONTROLS</h3>
            <div className="space-y-1 text-slate-300">
              <div>← → : Move</div>
              <div>↑ / Space: Rotate</div>
              <div>↓ : Soft Drop</div>
              <div>Shift: Hard Drop</div>
              <div>P: Pause</div>
              <div>1-4: Use Power-up</div>
            </div>
          </motion.div>

          <motion.div
            className="bg-slate-800/80 backdrop-blur-sm p-4 rounded-lg border border-purple-500/50 shadow-xl text-xs"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="text-purple-300 font-semibold mb-3">FEATURES</h3>
            <div className="space-y-1 text-slate-300">
              <div>✨ Ghost piece preview</div>
              <div>💥 Power-ups system</div>
              <div>🔥 Combo multipliers</div>
              <div>⚡ Dynamic difficulty</div>
              <div>🎯 Hard drop scoring</div>
              <div>🏆 High score tracking</div>
            </div>
          </motion.div>
        </div>
      </div>

      {ghostMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          className="absolute inset-0 bg-purple-500 pointer-events-none"
        />
      )}
    </div>
  );
}

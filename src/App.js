import React, { useEffect, useState, useRef } from "react";
import { Button, ButtonGroup } from "react-bootstrap";
import "./App.css";
import { useBeforeunload } from "react-beforeunload";

const STATS_KEY = "stats";
const BEEP_INTERVAL = 600000;

function formatTimeDelta(timeDelta, needSeconds = true) {
  const hours = Math.floor(timeDelta / 1000 / 60 / 60)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((timeDelta / 1000 / 60) % 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor((timeDelta / 1000) % 60)
    .toString()
    .padStart(2, "0");
  if (!needSeconds) {
    return `${hours}:${minutes}`;
  }
  return `${hours}:${minutes}:${seconds}`;
}

function Timer({ startTime, currentTime }) {
  if (!startTime) {
    return <div className="text-danger">Таймер остановлен</div>;
  }
  const timeDiff = currentTime - startTime;
  return <div>{formatTimeDelta(timeDiff)}</div>;
}

function Stats({ stats, period, title, startTime, currentTime }) {
  if (!stats) {
    return null;
  }
  const [periodStart, periodEnd] = period;
  const statsInPeriod = {};
  for (const [key, value] of Object.entries(stats)) {
    const date = new Date(parseInt(key));
    if (date >= periodStart && date <= periodEnd) {
      statsInPeriod[key] = value;
    }
  }
  const total = Object.values(statsInPeriod).reduce((a, b) => a + b, 0);
  if (startTime) {
    return (
      <div>
        {title}: {formatTimeDelta(total + (currentTime - startTime), false)}
      </div>
    );
  }
  return (
    <div>
      {title}: {formatTimeDelta(total, false)}
    </div>
  );
}

function getTodayPeriod() {
  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const end = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1
  );
  return [start, end];
}

function getThisWeekPeriod() {
  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - ((today.getDay() + 6) % 7)
  );
  const end = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 7 - ((today.getDay() + 6) % 7)
  );
  return [start, end];
}

function getLast7DaysPeriod() {
  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 6
  );
  const end = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1
  );
  return [start, end];
}

function getThisMonthPeriod() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return [start, end];
}

function getThisYearPeriod() {
  const today = new Date();
  const start = new Date(today.getFullYear(), 0, 1);
  const end = new Date(today.getFullYear() + 1, 0, 1);
  return [start, end];
}

function App() {
  function startTimer() {
    const st = new Date();
    setStartTime(st);
    setTickInterval(
      setInterval(() => {
        setCurrentTime(new Date());
      })
    );

    // Раз в 10 минут вызывавется эта пищалка. Можно поменять закодированный WAV файл
    function beep() {
      myAudio.current.play();
      if (window.scheduler) {
        const bi = window.debugBeepInterval || BEEP_INTERVAL;
        const nextBeepDelay = bi - ((new Date() - st) % bi);
        window.scheduler
          .postTask(beep, {
            delay: nextBeepDelay,
            signal: window.abortTaskController.signal,
          })
          .catch(() => {});
      }
    }
    // Запустили следующий цикл пищалки
    if (window.scheduler) {
      window.abortTaskController = new window.TaskController();
      window.scheduler
        .postTask(beep, {
          delay: window.debugBeepInterval || BEEP_INTERVAL,
          signal: window.abortTaskController.signal,
        })
        .catch(() => {});
    } else {
      setAlarmInterval(
        setInterval(beep, window.debugBeepInterval || BEEP_INTERVAL)
      );
    }
  }
  // Остановка таймера
  function stopTimer() {
    // Если не был запущен, то нечего и останавливать
    // Просто эту функцию вызывают не только по кнопке,
    // но и по закрытию окна
    if (!startTime) {
      return;
    }
    setStartTime(null);
    // !!!Не понял сути!!!
    let updatedStats = { ...stats };
    updatedStats[startTime.getTime()] = currentTime - startTime;
    // Сохранили текущую статистику
    saveStats(updatedStats);
    // Остановили таймер
    clearInterval(tickInterval);
    if (window.scheduler) {
      window.abortTaskController.abort();
    } else {
      // И десятиминутную пищалку тоже оствновили. Ибо нефиг
      clearInterval(alarmInterval);
    }
  }

  // Подгружаем статистику из внешнего хранилища
  function loadStats() {
    let loadedStats = localStorage.getItem(STATS_KEY);
    if (!loadedStats) {
      return {};
    }
    return JSON.parse(loadedStats);
  }
  // Сохраняем статистику во внешнем хранилище
  function saveStats(stats) {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    setStats(stats);
  }
  // Все свойства кнопки "Старт"
  const startButton = (
    <Button variant="success" size="lg" onClick={startTimer}>
      Старт
    </Button>
  );
  // Все свойства кнопки "Стоп"
  const stopButton = (
    <Button variant="danger" size="lg" onClick={stopTimer}>
      Стоп
    </Button>
  );
  const exportStats = () => {
    const statsString = JSON.stringify(stats);
    const blob = new Blob([statsString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "stats.json");
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const openImportPrompt = () => {
    inputFile.current.click();
  };
  const importStats = () => {
    const file = inputFile.current.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const loadedStats = JSON.parse(e.target.result);
      if (
        window.confirm(
          "Вы уверены, что хотите импортировать статистику? Все текущие данные будут утеряны!"
        )
      ) {
        saveStats(loadedStats);
      }
    };
    reader.readAsText(file);
  };
  const makeReport = () => {
    const report = Object.keys(stats)
      .filter((key) => {
        const date = new Date(Number(key));
        const today = new Date();
        return (
          date >=
          new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
        );
      })
      .map((key) => {
        const date = new Date(Number(key));
        const hours = Math.floor(stats[key] / 3600000);
        const minutes = Math.round((stats[key] % 3600000) / 60000);
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString()} - ${hours} часов ${minutes} минут`;
      })
      .join("\n");
    navigator.share({
      title: "Отчёт",
      text: report,
    });
  };

  const inputFile = useRef(null);
  const myAudio = useRef();
  const [startTime, setStartTime] = useState(null);
  const [currentTime, setCurrentTime] = useState(null);
  const [tickInterval, setTickInterval] = useState(null);
  const [alarmInterval, setAlarmInterval] = useState(null);
  const [stats, setStats] = useState(null);
  useEffect(() => {
    setStats(loadStats());
  }, []);
  useBeforeunload(stopTimer);
  return (
    <div className="container d-flex flex-column justify-content-between vh-100">
      <div className="d-flex flex-column align-items-center justify-content-center">
        <Timer startTime={startTime} currentTime={currentTime} />
        {startTime ? stopButton : startButton}

        <Stats
          period={getTodayPeriod()}
          stats={stats}
          title="Сегодня"
          startTime={startTime}
          currentTime={currentTime}
        />
        <Stats
          period={getLast7DaysPeriod()}
          stats={stats}
          title="Последние 7 дней"
          startTime={startTime}
          currentTime={currentTime}
        />
        <Stats
          period={getThisWeekPeriod()}
          stats={stats}
          title="Неделя"
          startTime={startTime}
          currentTime={currentTime}
        />
        <Stats
          period={getThisMonthPeriod()}
          stats={stats}
          title="Месяц"
          startTime={startTime}
          currentTime={currentTime}
        />
        <Stats
          period={getThisYearPeriod()}
          stats={stats}
          title="Год"
          startTime={startTime}
          currentTime={currentTime}
        />
      </div>
      <div>
        <ButtonGroup className="w-100">
          <Button variant="secondary" onClick={exportStats}>
            Экспортировать в файл
          </Button>
          <Button variant="secondary" onClick={openImportPrompt}>
            Импортировать из файла
          </Button>
          <Button variant="secondary" onClick={makeReport}>
            Создать отчёт
          </Button>
        </ButtonGroup>
        <input
          type="file"
          ref={inputFile}
          style={{ display: "none" }}
          onChange={importStats}
        />
      </div>
      <audio
        ref={myAudio}
        src="data:audio/wav;base64,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qJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU="
      />
    </div>
  );
}

export default App;

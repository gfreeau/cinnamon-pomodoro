const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Signals = imports.signals;
const Params = imports.misc.params;

/**
 * @constructor
 */
function TimerQueue() {
    this._init.call(this);
}

TimerQueue.prototype = {
    _init: function() {
        this._isFirstStart = true;
        this._queue = [];
        this._queuePos = 0;
        this._timerFinishedHandler = null;
    },

    addTimer: function(timer) {
        this._queue.push(timer);
    },

    start: function() {
        if (this._isFirstStart) {
            this.emit('timer-queue-started');
            this._isFirstStart = false;
        }

        return this._startNextTimer();
    },

    stop: function() {
        let timer = this.getCurrentTimer();

        if (timer == undefined) {
            return;
        }

        timer.stop();
    },

    reset: function() {
        this.stop();
        this._isFirstStart = true;
        this._queuePos = 0;
        this._queue.forEach(function(timer) {
           timer.reset();
        });
    },

    getCurrentTimer: function() {
        return this._queue[this._queuePos];
    },

    _startNextTimer: function() {
        let timer = this.getCurrentTimer();

        if (timer == undefined) {
            return false;
        }

        this._timerFinishedHandler = timer.connect('timer-finished', Lang.bind(this, this._timerFinished));

        timer.start();

        return true;
    },

    /**
     *
     * @param {Timer} timer
     * @private
     */
    _timerFinished: function(timer) {
        timer.disconnect(this._timerFinishedHandler);

        if (this._queueIsFinished()) {
            this.emit('timer-queue-finished');

            return;
        }

        this._queuePos++;
        this._startNextTimer();
    },

    _queueIsFinished: function() {
        return this._queuePos == (this._queue.length - 1);
    }
};

Signals.addSignalMethods(TimerQueue.prototype);

/**
 * @constructor
 */
function Timer(params) {
    Timer.prototype._init.call(this, params);
}

Timer.prototype = {
    /**
     * @private
     */
    _init: function(params) {
        params = Params.parse(params, { name: null, timerLimit: null });

        this._name = params.name;
        this.setTimerLimit(params.timerLimit);
        this._resetTimer();
    },

    getName: function() {
        return this._name;
    },

    /**
     *
     * @param {number} timerLimit
     */
    setTimerLimit: function(timerLimit) {
        if (typeof timerLimit != 'number' || timerLimit < 1) {
            throw new Error('timerLimit must be a number greater than 0 to run timer');
        }

        this._timerLimit = timerLimit;
    },

    /**
     * @returns {Timer}
     */
    start: function() {
        if (this._isFirstStart) {
            this._startTimer();
            return this;
        }

        this._refreshTimer();
        this._startTimer(true);

        return this;
    },

    /**
     * @returns {Timer}
     */
    stop: function() {
        if (null != this._tickTimeout) {
            Mainloop.source_remove(this._tickTimeout);
            this._tickTimeout = null;
            this.emit('timer-stopped');

            if (this._currentTickCount > 0) {
                this._isFirstStart = true;
            }
        }

        return this;
    },

    /**
     * @returns {Timer}
     */
    reset: function() {
        this._resetTimer();

        return this;
    },

    /**
     * @returns {number}
     */
    getTimesFinished: function() {
        return this._timesFinished;
    },

    getTicksRemaining: function() {
        return this._currentTickCount;
    },

    /**
     * @private
     */
    _startTimer: function(firstRun) {
        this._isFinished = false;
        this._isFirstStart = false;
        firstRun = Boolean(firstRun);

        if (firstRun) {
            this.emit('timer-started');
        }

        this.emit('timer-running');

        this.emit('timer-tick');
        this._tickTimeout = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._tick));
    },

    /**
     * @returns {boolean}
     * @private
     */
    _tick: function() {
        this._currentTickCount--;

        if (this._currentTickCount < 0) {
            this._finish();

            return false;
        }

        this.emit('timer-tick');

        return true;
    },

    /**
     * @private
     */
    _finish: function() {
        this.stop();
        this._isFinished = true;
        this._timesFinished++;
        this.emit('timer-finished');
    },

    /**
     * @private
     */
    _resetTimer: function() {
        this._isFirstStart = false;
        this._isFinished = false;
        this._tickTimeout = null;
        this._timesFinished = 0;
        this._refreshTimer();
    },

    _refreshTimer: function() {
        this._currentTickCount = this._timerLimit;
    }
};

Signals.addSignalMethods(Timer.prototype);
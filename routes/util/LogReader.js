'use strict';

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const Stream = require('stream');

const { STATUS, RIP_PROGRESS_CONSTANTS, REVERSE_STATUS_LOOKUP, RIP_REGEXPS } = require('./HBStatus');
const config = require('../../config/properties.json');
const ReaderUtil = require("./ReaderUtil");


class LogReader {
	/**
	 * Constructor for accepting test seam arguments for test contexts
	 * @param fileRedirect {string=}
	 * @param mockedTime {Date=}
	 */
	constructor(fileRedirect, mockedTime) {
		this.testSeam_fileRedirect = fileRedirect;
		this.testSeam_currentTime = mockedTime;
	}

	/**
	 * Get an enumeration of the current HandBrake status based on the recent activity in the log file.
	 *
	 * We sequentially review the whole activity log, so it can be useful to periodically clear out the log file
	 * to reduce computation time (but it's generally pretty quick!).
	 *
	 * @returns {Promise<{currentEncode: string, startTime: string, endTime: string, status: string, statusText: string, eta: string}>}
	 */
	getHBStatusItems() {
		let hbPath = path.join(config.handbrakePath.replace('~', require('os').homedir()));
		if (this.testSeam_fileRedirect)
			hbPath = this.testSeam_fileRedirect;

		let inStream = fs.createReadStream(hbPath);
		return new Promise((resolve, reject) => {
			let rl = readline.createInterface(inStream, new Stream());

			this.status = {};
			this.clearStats();

			rl.on('line', line => {
				this.addLineIfIsIndicator(line);
				this.resolveStatus(line);
			});

			rl.on('error', reject);

			rl.on('close', () => {
				this.status.status = REVERSE_STATUS_LOOKUP[this.status.statusText];
				this.status.eta = this.calcEta();
				resolve(this.status);
			});
		});
	}

	/**
	 * Reset all the status items to their default state
	 */
	clearStats() {
		this.status.currentEncode = '';
		this.status.startTime = '';
		this.status.endTime = '';
		this.status.statusText = STATUS.QUEUE_COMPLETE;
		this.status.numChapters = -1
		this.status.etaEstimators = [];
		this.status.eta = '';
	}

	/**
	 * Check if the current line matches a regular expression that yields:
	 * 1. The number of chapters in the current encode
	 * 2. The line contains a chapter scan completion message
	 *
	 * Both are used for estimating the time remaining in the encode phase of the rip.
	 *
	 * @param line {string} a log line from the
	 */
	addLineIfIsIndicator(line) {
		if (line.match(RIP_REGEXPS.TITLE_NUMBER))
			this.status.numChapters = Number(line.slice(-2).trim()); // take the last two characters, which always contains the number of chapters in an encode
		else if (line.match(RIP_REGEXPS.CHAPTER_PROGRESS))
			this.status.etaEstimators.push(line); // just save the whole line, we'll parse out the times out later
	}

	/**
	 * Resolve the status of the current rip based on the content in the line passed in
	 * @param line
	 */
	resolveStatus(line) {
		// by default, the status is the same as it was on the last line
		let lineStatus = ReaderUtil.lineToStatus(line, this.status.statusText);

		switch (lineStatus) {
			case STATUS.SCANNING:
			case STATUS.SCAN_COMPLETE:
				this.clearStats();
				break;
			case STATUS.RIPPING:
				// bail if this isn't the line that switched us to RIPPING
				if (!ReaderUtil.lineContains(line, RIP_PROGRESS_CONSTANTS.ENCODE_STARTED))
					break;

				this.clearStats();
				this.status.startTime = line.slice(1, 9);
				this.status.currentEncode = ReaderUtil.getEncodeName(line);
				break;
			case STATUS.RIPPING_SUB_SCAN:
			case STATUS.RIPPING_ENCODING:
				this.status.eta = "~";
				break;
			case STATUS.QUEUE_COMPLETE:
				this.status.endTime = line.slice(1, 9);
				break;
		}

		// no matter what, set the status text string
		this.status.statusText = lineStatus;
	}

	/**
	 * Calculate the ETA for the current rip -- so far this is accurate to about 10%, which is about as good as
	 * HandBrake's underlying estimations.
	 * @returns {string} The string representing the time remaining in a rip
	 */
	calcEta() {
		const status = this.status.statusText
		if (status === STATUS.QUEUE_COMPLETE)
			return '00:00:00';

		if (status !== STATUS.RIPPING_ENCODING && status !== STATUS.RIPPING_SUB_SCAN)
			return '';

		if (this.status.etaEstimators.length < 2)
			return '~';

		const etaDates = this.status.etaEstimators.map(est => {
			return ReaderUtil.getDateFromTime(est.slice(1, 9));
		});

		// calculate the difference between each successful rip notification
		const dateDiffs = [];
		for (let i = 1; i < etaDates.length; i++)
			dateDiffs.push(etaDates[i] - etaDates[i - 1]);

		// just in case, likely not used anymore
		if (dateDiffs.length === 0)
			return '00:00:00';

		// sum and average
		let sum = 0;
		for (let i = 0; i < dateDiffs.length; i++)
			sum += dateDiffs[i];

		// generally we calculate ETA from now, but allow tests to inject custom dates as neeed
		let currentDate = new Date();
		if (this.testSeam_currentTime)
			currentDate = new Date(this.testSeam_currentTime);

		// grab the number of chapters left to rip
		const numRemainingChapters = this.status.numChapters - this.status.etaEstimators.length;

		// take the average of all the chapter rip times, multiply it by the number of remaining chapters
		// and subtract the amount of time that elapsed between the time the last estimator was found
		// and convert from ms -> seconds
		const avg = (sum / dateDiffs.length);
		const msSinceCheckin = (currentDate - etaDates[etaDates.length - 1]);
		const timeInSecs = ((avg * numRemainingChapters) - msSinceCheckin) / 1000;

		return ReaderUtil.secondsToFormattedTime(timeInSecs);
	}
}

module.exports = LogReader;

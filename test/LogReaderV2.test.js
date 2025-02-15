'use strict';

const { expect } = require('chai');
const path = require('path');
const LogReaderV2 = require('../routes/util/LogReaderV2');
const { STATUS, REVERSE_STATUS_LOOKUP } = require('../routes/util/HBStatus');


describe('LogReaderV2', () => {
	/**
	 * E2E tests using real log files as sources
	 */
	describe('#getHBStatusItems', () => {
		const getTestDate = (hours, mins, secs) => {
			const d = new Date();
			d.setHours(hours);
			d.setMinutes(mins);
			d.setSeconds(secs);
			return d;
		}

		it('should successfully parse the correct metadata for a successful movie rip', () => {
			const fr = new LogReaderV2(path.join(__dirname, 'resources', 'SNATCHED.txt'));
			return fr.getHBStatusItems().then(status => {
				expect(status.currentEncode).to.equal('Snatched');
				expect(status.startTime).to.equal('23:55:58');
				expect(status.endTime).to.equal('00:34:57');
				expect(status.statusText).to.equal(STATUS.QUEUE_COMPLETE);
				expect(status.status).to.equal(REVERSE_STATUS_LOOKUP[STATUS.QUEUE_COMPLETE]);
				expect(status.eta).to.equal('00:00:00');
			});
		});

		it('should successfully parse metadata for a rip that is in progress', () => {
			const fr = new LogReaderV2(path.join(__dirname, 'resources', 'HOW_TO_BE_SINGLE_PARTIAL_ENCODING.txt'), getTestDate(1, 30, 30));
			return fr.getHBStatusItems().then(status => {
				expect(status.currentEncode).to.equal('How to be Single');
				expect(status.startTime).to.equal('00:43:52');
				expect(status.endTime).to.equal('');
				expect(status.statusText).to.equal(STATUS.RIPPING_ENCODING);
				expect(status.status).to.equal(REVERSE_STATUS_LOOKUP[STATUS.RIPPING_ENCODING]);
				expect(status.eta).to.equal('00:03:12');
			});
		});

		it('should successfully parse data for a COMPLETED TV Show rip', () => {
			const fr = new LogReaderV2(path.join(__dirname, 'resources', 'ST_NEXTGEN_D1.txt'), getTestDate(3, 10, 10));
			return fr.getHBStatusItems().then(status => {
				expect(status.currentEncode).to.equal('NEXTGEN_S07_E04');
				expect(status.startTime).to.equal('02:56:22');
				expect(status.endTime).to.equal('03:08:29');
				expect(status.statusText).to.equal(STATUS.QUEUE_COMPLETE);
				expect(status.status).to.equal(REVERSE_STATUS_LOOKUP[STATUS.QUEUE_COMPLETE]);
				expect(status.eta).to.equal('00:00:00');
			});
		});

		it('should successfully parse data for a IN PROGRESS TV Show rip', () => {
			const fr = new LogReaderV2(path.join(__dirname, 'resources', 'ST_NEXTGEN_D1_PARTIAL_E04.txt'), getTestDate(3, 7, 20));
			return fr.getHBStatusItems().then(status => {
				expect(status.currentEncode).to.equal('NEXTGEN_S07_E04');
				expect(status.startTime).to.equal('02:56:22');
				expect(status.endTime).to.equal('');
				expect(status.statusText).to.equal(STATUS.RIPPING_ENCODING);
				expect(status.status).to.equal(REVERSE_STATUS_LOOKUP[STATUS.RIPPING_ENCODING]);
				expect(status.eta).to.equal('00:00:56');
			});
		});

		it('should report status RIPPING_SUB_SCAN during subtitle scans', () => {
			const fr = new LogReaderV2(path.join(__dirname, 'resources', 'HOW_TO_BE_SINGLE_PARTIAL_SCANNING.txt'), getTestDate(0, 44, 0));
			return fr.getHBStatusItems().then(status => {
				expect(status.currentEncode).to.equal('How to be Single');
				expect(status.startTime).to.equal('00:43:52');
				expect(status.endTime).to.equal('');
				expect(status.statusText).to.equal(STATUS.RIPPING_SUB_SCAN);
				expect(status.status).to.equal(REVERSE_STATUS_LOOKUP[STATUS.RIPPING_SUB_SCAN]);
				expect(status.eta).to.equal('~');
			});
		});

		it('should report status SCANNING during initial scan', () => {
			const fr = new LogReaderV2(path.join(__dirname, 'resources', 'THE_WITCHES_PARTIAL_SCAN.log.txt'), getTestDate(0, 44, 0));
			return fr.getHBStatusItems().then(status => {
				expect(status.currentEncode).to.equal('');
				expect(status.startTime).to.equal('');
				expect(status.endTime).to.equal('');
				expect(status.statusText).to.equal(STATUS.SCANNING);
				expect(status.status).to.equal(REVERSE_STATUS_LOOKUP[STATUS.SCANNING]);
				expect(status.eta).to.equal('');
			});
		});

		it('should report status SCAN_COMPLETE after initial scan', () => {
			const fr = new LogReaderV2(path.join(__dirname, 'resources', 'THE_WITCHES_FULL_SCAN.log.txt'), getTestDate(0, 44, 0));
			return fr.getHBStatusItems().then(status => {
				expect(status.currentEncode).to.equal('');
				expect(status.startTime).to.equal('');
				expect(status.endTime).to.equal('');
				expect(status.statusText).to.equal(STATUS.SCAN_COMPLETE);
				expect(status.status).to.equal(REVERSE_STATUS_LOOKUP[STATUS.SCAN_COMPLETE]);
				expect(status.eta).to.equal('');
			});
		});

		it('should report status SCAN_COMPLETE after initial scan II', () => {
			const fr = new LogReaderV2(path.join(__dirname, 'resources', 'HOME_ALONE_SCAN.log.txt'), getTestDate(0, 44, 0));
			return fr.getHBStatusItems().then(status => {
				expect(status.currentEncode).to.equal('');
				expect(status.startTime).to.equal('');
				expect(status.endTime).to.equal('');
				expect(status.statusText).to.equal(STATUS.SCAN_COMPLETE);
				expect(status.status).to.equal(REVERSE_STATUS_LOOKUP[STATUS.SCAN_COMPLETE]);
				expect(status.eta).to.equal('');
			});
		});

		it('should report status ENCODING for CHUCK_ENCODE', () => {
			const fr = new LogReaderV2(path.join(__dirname, 'resources', 'CHUCK_ENCODE.log.txt'), getTestDate(0, 44, 0));
			return fr.getHBStatusItems().then(status => {
				expect(status.currentEncode).to.equal('CHUCK_S04_E07');
				expect(status.startTime).to.equal('14:33:24');
				expect(status.endTime).to.equal('');
				expect(status.statusText).to.equal(STATUS.RIPPING_ENCODING);
				expect(status.status).to.equal(REVERSE_STATUS_LOOKUP[STATUS.RIPPING_ENCODING]);
				expect(status.eta).to.equal('14:00:12'); // this is weird - it shouldn't be so high
			});
		});

		it('should report status RIPPING_SUB_SCAN for CHUCK_SCAN', () => {
			const fr = new LogReaderV2(path.join(__dirname, 'resources', 'CHUCK_SCAN.log.txt'), getTestDate(0, 44, 0));
			return fr.getHBStatusItems().then(status => {
				expect(status.currentEncode).to.equal('CHUCK_S04_E08');
				expect(status.startTime).to.equal('14:44:15');
				expect(status.endTime).to.equal('');
				expect(status.statusText).to.equal(STATUS.RIPPING_SUB_SCAN);
				expect(status.status).to.equal(REVERSE_STATUS_LOOKUP[STATUS.RIPPING_SUB_SCAN]);
				expect(status.eta).to.equal('~');
			});
		});

		it('should report report a reasonable RIPPING_SUB_SCAN for CHUCK_SCAN', () => {
			const fr = new LogReaderV2(path.join(__dirname, 'resources', 'DARIA_E01.log.txt'), getTestDate(18, 27, 0));
			return fr.getHBStatusItems().then(status => {
				expect(status.currentEncode).to.equal('DARIA_S01_E01');
				expect(status.startTime).to.equal('18:26:08');
				expect(status.endTime).to.equal('');
				expect(status.statusText).to.equal(STATUS.RIPPING_ENCODING);
				expect(status.status).to.equal(REVERSE_STATUS_LOOKUP[STATUS.RIPPING_ENCODING]);
				expect(status.eta).to.equal('00:05:24');
			});
		});
	});
});

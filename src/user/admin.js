
'use strict';

var async = require('async');
var winston = require('winston');
var validator = require('validator');

var db = require('../database');
var plugins = require('../plugins');

module.exports = function (User) {
	User.logIP = function (uid, ip, callback) {
		if (!(parseInt(uid, 10) > 0)) {
			return setImmediate(callback);
		}
		var now = Date.now();
		const bulk = [
			['uid:' + uid + ':ip', now, ip || 'Unknown'],
		];
		if (ip) {
			bulk.push(['ip:' + ip + ':uid', now, uid]);
		}
		db.sortedSetAddBulk(bulk, callback);
	};

	User.getIPs = function (uid, stop, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRevRange('uid:' + uid + ':ip', 0, stop, next);
			},
			function (ips, next) {
				next(null, ips.map(ip => validator.escape(String(ip))));
			},
		], callback);
	};

	User.getUsersCSV = function (callback) {
		winston.verbose('[user/getUsersCSV] Compiling User CSV data');
		var csvContent = '';
		var uids;
		async.waterfall([
			function (next) {
				db.getSortedSetRange('users:joindate', 0, -1, next);
			},
			function (_uids, next) {
				uids = _uids;
				plugins.fireHook('filter:user.csvFields', { fields: ['uid', 'email', 'username'] }, next);
			},
			function (data, next) {
				User.getUsersFields(uids, data.fields, next);
			},
			function (usersData, next) {
				usersData.forEach(function (user) {
					if (user) {
						csvContent += user.email + ',' + user.username + ',' + user.uid + '\n';
					}
				});

				next(null, csvContent);
			},
		], callback);
	};
};

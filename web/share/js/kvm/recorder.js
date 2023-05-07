/*****************************************************************************
#                                                                            #
#    KVMD - The main PiKVM daemon.                                           #
#                                                                            #
#    Copyright (C) 2018-2022  Maxim Devaev <mdevaev@gmail.com>               #
#                                                                            #
#    This program is free software: you can redistribute it and/or modify    #
#    it under the terms of the GNU General Public License as published by    #
#    the Free Software Foundation, either version 3 of the License, or       #
#    (at your option) any later version.                                     #
#                                                                            #
#    This program is distributed in the hope that it will be useful,         #
#    but WITHOUT ANY WARRANTY; without even the implied warranty of          #
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the           #
#    GNU General Public License for more details.                            #
#                                                                            #
#    You should have received a copy of the GNU General Public License       #
#    along with this program.  If not, see <https://www.gnu.org/licenses/>.  #
#                                                                            #
*****************************************************************************/


"use strict";


import {tools, $} from "../tools.js";
import {wm} from "../wm.js";


export function Recorder() {
	var self = this;

	/************************************************************************/

	var __ws = null;

	var __play_timer = null;
	var __recording = false;
	var __events = [];
	var __events_time = 0;
	var __last_event_ts = 0;

	var __init__ = function() {
		tools.el.setOnClick($("hid-recorder-record"), __startRecord);
		tools.el.setOnClick($("hid-recorder-stop"), __stopProcess);
		tools.el.setOnClick($("hid-recorder-play"), __playRecord);
		tools.el.setOnClick($("hid-recorder-clear"), __clearRecord);
		tools.el.setOnClick($("hid-recorder-netstat"), __setNetstat);

		$("hid-recorder-new-script-file").onchange = __uploadScript;
		tools.el.setOnClick($("hid-recorder-upload"), () => $("hid-recorder-new-script-file").click());
		tools.el.setOnClick($("hid-recorder-download"), __downloadScript);
		tools.el.setOnClick($("hid-node-open-1"), __open_node1);
		tools.el.setOnClick($("hid-node-open-2"), __open_node2);
		tools.el.setOnClick($("hid-node-open-3"), __open_node3);
		tools.el.setOnClick($("hid-node-open-4"), __open_node4);
		tools.el.setOnClick($("hid-node-open-5"), __open_node5);
		tools.el.setOnClick($("hid-node-open-6"), __open_node6);
		tools.el.setOnClick($("hid-node-open-7"), __open_node7);
		tools.el.setOnClick($("hid-node-open-8"), __open_node8);
		tools.el.setOnClick($("hid-node-close-1"), __close_node1);
		tools.el.setOnClick($("hid-node-close-2"), __close_node2);
		tools.el.setOnClick($("hid-node-close-3"), __close_node3);
		tools.el.setOnClick($("hid-node-close-4"), __close_node4);
		tools.el.setOnClick($("hid-node-close-5"), __close_node5);
		tools.el.setOnClick($("hid-node-close-6"), __close_node6);
		tools.el.setOnClick($("hid-node-close-7"), __close_node7);
		tools.el.setOnClick($("hid-node-close-8"), __close_node8);
		tools.el.setOnClick($("hid-chassis-open"), __open_chassis);
		tools.el.setOnClick($("hid-chassis-close"), __close_chassis);
	};

	/************************************************************************/

	self.setSocket = function(ws) {
		if (ws !== __ws) {
			__ws = ws;
		}
		if (__ws === null) {
			__stopProcess();
		}
		__refresh();
	};

	self.recordWsEvent = function(event) {
		__recordEvent(event);
	};

	self.recordPrintEvent = function(text) {
		__recordEvent({"event_type": "print", "event": {"text": text}});
	};

	self.recordAtxButtonEvent = function(button) {
		__recordEvent({"event_type": "atx_button", "event": {"button": button}});
	};

	self.recordGpioSwitchEvent = function(channel, to) {
		__recordEvent({"event_type": "gpio_switch", "event": {"channel": channel, "state": to}});
	};

	self.recordGpioPulseEvent = function(channel) {
		__recordEvent({"event_type": "gpio_pulse", "event": {"channel": channel}});
	};

	var __recordEvent = function(event) {
		if (__recording) {
			let now = new Date().getTime();
			if (__last_event_ts) {
				let delay = now - __last_event_ts;
				__events.push({"event_type": "delay", "event": {"millis": delay}});
				__events_time += delay;
			}
			__last_event_ts = now;
			__events.push(event);
			__setCounters(__events.length, __events_time);
		}
	};

	var __startRecord = function() {
		__clearRecord();
		__recording = true;
		__refresh();
	};

	var __stopProcess = function() {
		if (__play_timer) {
			clearTimeout(__play_timer);
			__play_timer = null;
		}
		if (__recording) {
			__recording = false;
		}
		__refresh();
	};

	var __setNetstat = function() {
		let address = $("hid-network-input-address").value
		let gateway = $("hid-network-input-gateway").value
		let dns = $("hid-network-input-dns").value
		let mask = $("hid-network-input-mask").value
		// let body = {
		// 	"address": $("hid-network-input-address").value,
		// 	"gateway": $("hid-network-input-gateway").value,
		// 	"dns": $("hid-network-input-dns").value
		// }
		let url = "/api/netstat?address=" + address + "&gateway=" + gateway + "&dns=" + dns + "&mask=" + mask
		let http = tools.makeRequest("POST", url, function() {
			if (http.readyState === 4) {
				if (http.status !== 200) {
					wm.error("HID reset error:<br>", http.responseText);
				}
			}
		});
	}

	var __playRecord = function() {
		__play_timer = setTimeout(() => __runEvents(0), 0);
		__refresh();
	};

	var __clearRecord = function() {
		__events = [];
		__events_time = 0;
		__last_event_ts = 0;
		__refresh();
	};

	var __downloadScript = function() {
		let blob = new Blob([JSON.stringify(__events, undefined, 4)], {"type": "application/json"});
		let url = window.URL.createObjectURL(blob);
		let el_anchor = document.createElement("a");
		el_anchor.href = url;
		el_anchor.download = "script.json";
		el_anchor.click();
		window.URL.revokeObjectURL(url);
	};

	var __uploadScript = function() {
		let el_input = $("hid-recorder-new-script-file");
		let script_file = (el_input.files.length ? el_input.files[0] : null);
		if (script_file) {
			let reader = new FileReader();
			reader.onload = function () {
				let events = [];
				let events_time = 0;

				try {
					let raw_events = JSON.parse(reader.result);
					__checkType(raw_events, "object", "Base of script is not an objects list");

					for (let event of raw_events) {
						__checkType(event, "object", "Non-dict event");
						__checkType(event.event, "object", "Non-dict event");

						if (event.event_type === "delay") {
							__checkInt(event.event.millis, "Non-integer delay");
							if (event.event.millis < 0) {
								throw "Negative delay";
							}
							events_time += event.event.millis;
						} else if (event.event_type === "print") {
							__checkType(event.event.text, "string", "Non-string print text");
						} else if (event.event_type === "key") {
							__checkType(event.event.key, "string", "Non-string key code");
							__checkType(event.event.state, "boolean", "Non-bool key state");
						} else if (event.event_type === "mouse_button") {
							__checkType(event.event.button, "string", "Non-string mouse button code");
							__checkType(event.event.state, "boolean", "Non-bool mouse button state");
						} else if (event.event_type === "mouse_move") {
							__checkType(event.event.to, "object", "Non-object mouse move target");
							__checkInt(event.event.to.x, "Non-int mouse move X");
							__checkInt(event.event.to.y, "Non-int mouse move Y");
						} else if (event.event_type === "mouse_wheel") {
							__checkType(event.event.delta, "object", "Non-object mouse wheel delta");
							__checkInt(event.event.delta.x, "Non-int mouse delta X");
							__checkInt(event.event.delta.y, "Non-int mouse delta Y");
						} else if (event.event_type === "atx_button") {
							__checkType(event.event.button, "string", "Non-string ATX button");
						} else if (event.event_type === "gpio_switch") {
							__checkType(event.event.channel, "string", "Non-string GPIO channel");
							__checkType(event.event.state, "boolean", "Non-bool GPIO state");
						} else if (event.event_type === "gpio_pulse") {
							__checkType(event.event.channel, "string", "Non-string GPIO channel");
						} else {
							throw `Unknown event type: ${event.event_type}`;
						}

						events.push(event);
					}

					__events = events;
					__events_time = events_time;
				} catch (err) {
					wm.error(`Invalid script: ${err}`);
				}

				el_input.value = "";
				__refresh();
			};
			reader.readAsText(script_file, "UTF-8");
		}
	};

	var __checkType = function(obj, type, msg) {
		if (typeof obj !== type) {
			throw msg;
		}
	};

	var __checkInt = function(obj, msg) {
		if (!Number.isInteger(obj)) {
			throw msg;
		}
	};

	var __runEvents = function(index, time=0) {
		while (index < __events.length) {
			__setCounters(__events.length - index + 1, __events_time - time);
			let event = __events[index];

			if (event.event_type === "delay") {
				__play_timer = setTimeout(() => __runEvents(index + 1, time + event.event.millis), event.event.millis);
				return;

			} else if (event.event_type === "print") {
				let http = tools.makeRequest("POST", "/api/hid/print?limit=0", function() {
					if (http.readyState === 4) {
						if (http.status === 413) {
							wm.error("Too many text for paste!");
							__stopProcess();
						} else if (http.status !== 200) {
							wm.error("HID paste error:<br>", http.responseText);
							__stopProcess();
						} else if (http.status === 200) {
							__play_timer = setTimeout(() => __runEvents(index + 1, time), 0);
						}
					}
				}, event.event.text, "text/plain");
				return;

			} else if (event.event_type === "atx_button") {
				let http = tools.makeRequest("POST", `/api/atx/click?button=${event.event.button}`, function() {
					if (http.readyState === 4) {
						if (http.status !== 200) {
							wm.error("ATX error:<br>", http.responseText);
							__stopProcess();
						} else if (http.status === 200) {
							__play_timer = setTimeout(() => __runEvents(index + 1, time), 0);
						}
					}
				});
				return;

			} else if (["gpio_switch", "gpio_pulse"].includes(event.event_type)) {
				let path = "/api/gpio";
				if (event.event_type === "gpio_switch") {
					path += `/switch?channel=${event.event.channel}&state=${event.event.to}`;
				} else { // gpio_pulse
					path += `/pulse?channel=${event.event.channel}`;
				}
				let http = tools.makeRequest("POST", path, function() {
					if (http.readyState === 4) {
						if (http.status !== 200) {
							wm.error("GPIO error:<br>", http.responseText);
							__stopProcess();
						} else if (http.status === 200) {
							__play_timer = setTimeout(() => __runEvents(index + 1, time), 0);
						}
					}
				});
				return;

			} else if (["key", "mouse_button", "mouse_move", "mouse_wheel"].includes(event.event_type)) {
				__ws.send(JSON.stringify(event));
			}

			index += 1;
		}
		if ($("hid-recorder-loop-switch").checked) {
			setTimeout(() => __runEvents(0));
		} else {
			__stopProcess();
		}
	};

	var __refresh = function() {
		if (__play_timer) {
			$("hid-recorder-led").className = "led-yellow-rotating-fast";
			$("hid-recorder-led").title = "Playing...";
		} else if (__recording) {
			$("hid-recorder-led").className = "led-red-rotating-fast";
			$("hid-recorder-led").title = "Recording...";
		} else {
			$("hid-recorder-led").className = "led-gray";
			$("hid-recorder-led").title = "";
		}

		tools.el.setEnabled($("hid-recorder-record"), (__ws && !__play_timer && !__recording));
		tools.el.setEnabled($("hid-recorder-stop"), (__ws && (__play_timer || __recording)));
		tools.el.setEnabled($("hid-recorder-play"), (__ws && !__recording && __events.length));
		tools.el.setEnabled($("hid-recorder-clear"), (!__play_timer && !__recording && __events.length));
		tools.el.setEnabled($("hid-recorder-loop-switch"), (__ws && !__recording));

		tools.el.setEnabled($("hid-recorder-upload"), (!__play_timer && !__recording));
		tools.el.setEnabled($("hid-recorder-download"), (!__play_timer && !__recording && __events.length));

		__setCounters(__events.length, __events_time);
		__getNetConfig();
		__getNodeStatus();
		__get_chassis_status();
	};

	var __setCounters = function(events_count, events_time) {
		$("hid-recorder-time").innerHTML = tools.formatDuration(events_time);
		$("hid-recorder-events-count").innerHTML = events_count;
	};

	var __getNetConfig = function() {
		let http = tools.makeRequest("GET", "/api/netstat", function() {
			if (http.readyState === 4) {
				if (http.status !== 200) {
					wm.error("HID reset error:<br>", http.responseText);
				}
			}
			console.log(http.responseText)
			let info = JSON.parse(http.responseText).result;
			$("hid-network-input-address").value = info.Address;
			$("hid-network-input-gateway").value = info.Gateway;
			$("hid-network-input-dns").value = info.DNS;
			$("hid-network-input-mask").value = info.Mask;
		});		
	};

	var __getNodeStatus = function() {
		console.log("get node status");
		let http = tools.makeRequest("GET", "/api/chassis_type", function() {
			if (http.readyState === 4) {
				if (http.status !== 200) {
					wm.error("HID reset error:<br>", http.responseText);
				}
			}
			let node_num = JSON.parse(http.responseText).result.num;
			let res = JSON.parse(http.responseText).result.res;
			console.log(node_num)
			//var node_num = 2;
			for (var i=1;i<=node_num;i++) {
				// var open_temp_id = "hid-node-open-" + i.toString();
				// tools.el.setEnabled($(open_temp_id), false);
				// var close_temp_id = "hid-node-close-" + i.toString();
				// tools.el.setEnabled($(close_temp_id), false);
				var temp_id = "hid-node-" + i.toString();
				tools.feature.setEnabled($(temp_id), true);
				var temp_id1 = "hid-node" + i.toString();
				$(temp_id1).innerHTML = res[i];
				
			}

		});	
		// var node_num = 2;
		// for (var i=1;i<=node_num;i++) {
		// 	// var open_temp_id = "hid-node-open-" + i.toString();
		// 	// tools.el.setEnabled($(open_temp_id), false);
		// 	// var close_temp_id = "hid-node-close-" + i.toString();
		// 	// tools.el.setEnabled($(close_temp_id), false);
		// 	var temp_id = "hid-node-" + i.toString();
		// 	tools.feature.setEnabled($(temp_id), true);
			
		// }
		// 获取节点数量，屏蔽未使用到的节点
		// let node1_status = "not exist";
		// let node2_status = "not exist";
		// let node3_status = "OFF";
		// let node4_status = "ON";
		// $("hid-node1").innerHTML = node1_status;
		// $("hid-node2").innerHTML = node2_status;
		// $("hid-node3").innerHTML = node3_status;
		// $("hid-node4").innerHTML = node4_status;
		// if (node1_status == "not exist") {
		// 	tools.el.setEnabled($("hid-node-open-1"), false);
		// 	tools.el.setEnabled($("hid-node-close-1"), false);
		// } else {
		// 	tools.el.setEnabled($("hid-node-open-1"), true);
		// 	tools.el.setEnabled($("hid-node-close-1"), true);
		// }

		// if (node2_status == "not exist") {
		// 	tools.el.setEnabled($("hid-node-open-2"), false);
		// 	tools.el.setEnabled($("hid-node-close-2"), false);
		// } else {
		// 	tools.el.setEnabled($("hid-node-open-2"), true);
		// 	tools.el.setEnabled($("hid-node-close-2"), true);
		// }

		// if (node3_status == "not exist") {
		// 	tools.el.setEnabled($("hid-node-open-3"), false);
		// 	tools.el.setEnabled($("hid-node-close-3"), false);
		// } else {
		// 	tools.el.setEnabled($("hid-node-open-3"), true);
		// 	tools.el.setEnabled($("hid-node-close-3"), true);
		// }

		// if (node4_status == "not exist") {
		// 	tools.el.setEnabled($("hid-node-open-4"), false);
		// 	tools.el.setEnabled($("hid-node-close-4"), false);
		// } else {
		// 	tools.el.setEnabled($("hid-node-open-4"), true);
		// 	tools.el.setEnabled($("hid-node-close-4"), true);
		// }

	};

	var __open_node = function(i) {
		let url = "/api/open_node?num=" + i;
		let http = tools.makeRequest("POST", url, function() {
			if (http.readyState === 4) {
				if (http.status !== 200) {
					wm.error("HID reset error:<br>", http.responseText);
				}
			}
		});
	};

	var __close_node = function(i) {
		let url = "/api/close_node?num=" + i;
		let http = tools.makeRequest("POST", url, function() {
			if (http.readyState === 4) {
				if (http.status !== 200) {
					wm.error("HID reset error:<br>", http.responseText);
				}
			}
		});
	};

	var __open_node1 = function() {
		console.log("open node 1");
		__open_node(1);
	};

	var __close_node1 = function() {
		console.log("close node 1");
		__close_node(1);
	};

	var __open_node2 = function() {
		console.log("open node 2");
		__open_node(2);
	};

	var __close_node2 = function() {
		console.log("close node 2");
		__close_node(2);
	};

	var __open_node3 = function() {
		console.log("open node 3");
		__open_node(3);
	};

	var __close_node3 = function() {
		console.log("close node 3");
		__close_node(3);
	};

	var __open_node4 = function() {
		console.log("open node 4");
		__open_node(4);
	};

	var __close_node4 = function() {
		console.log("close node 4");
		__close_node(4);
	};

	var __open_node5 = function() {
		console.log("open node 5");
		__open_node(5);
	};

	var __close_node5 = function() {
		console.log("close node 5");
		__close_node(5);
	};

	var __open_node6 = function() {
		console.log("open node 6");
		__open_node(6);
	};

	var __close_node6 = function() {
		console.log("close node 6");
		__close_node(6);
	};

	var __open_node7 = function() {
		console.log("open node 7");
		__open_node(7);
	};

	var __close_node7 = function() {
		console.log("close node 7");
		__close_node(7);
	};

	var __open_node8 = function() {
		console.log("open node 8");
		__open_node(8);
	};

	var __close_node8 = function() {
		console.log("close node 8");
		__close_node(8);
	};

	var __get_chassis_status = function() {
		let http = tools.makeRequest("GET", "/api/chassis_status", function() {
			if (http.readyState === 4) {
				if (http.status !== 200) {
					wm.error("HID reset error:<br>", http.responseText);
				}
			}
			let res = JSON.parse(http.responseText).result;
			$("hid-chassis-status").innerHTML = res.chassis_status;
			$("hid-chassis-kvm-status").innerHTML = res.kvm_status;
		});	
		
	};

	var __open_chassis = function() {
		let http = tools.makeRequest("POST", "/api/chassis_open", function() {
			console.log("open chassis");
			if (http.readyState === 4) {
				if (http.status !== 200) {
					wm.error("HID reset error:<br>", http.responseText);
				}
			}
		});	
	};

	var __close_chassis = function() {
		let http = tools.makeRequest("POST", "/api/chassis_close", function() {
			console.log("close chassis");
			if (http.readyState === 4) {
				if (http.status !== 200) {
					wm.error("HID reset error:<br>", http.responseText);
				}
			}
		});	
	};
	__init__();
}

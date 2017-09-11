$(function() {

	var api = "/api/";
	var $chou = $("#chou");
	var $zhong = $("#zhong");
	var $sun = $("#sun");
	var $gu = $("#gu");
	var isFirefox = navigator.userAgent.indexOf("Firefox") != -1;
	var mousewheel = isFirefox ? "DOMMouseScroll" : "mousewheel";

	function ajax(url, param, type, contentType) {
		return $.ajax({
			url: url,
			data: param || {},
			type: type || 'GET',
			contentType: contentType || 'application/x-www-form-urlencoded'
		})
	}

	function preloadImages(arr) {
		var newImages = [];
		for (var i = 0; i < arr.length; i++) {
			newImages[i] = new Image()
			newImages[i].src = arr[i]
		}
	}

	function errMsg(err) {
		var errObj = JSON.parse(err.responseText || {});
		if (errObj.error) {
			alert(errObj.error.description);
		} else {
			alert('哎呀，服务器泡妞了...');
		}
	}

	var local = {
		set: function(key, val) {
			return localStorage.setItem(key, val);
		},
		get: function(key) {
			return localStorage.getItem(key);
		},
		del: function(key) {
			return localStorage.removeItem(key);
		}
	}

	var Card = (function() {

		// Card对象
		function Card() {
			this.init();
		}

		// 初始化
		Card.prototype.init = function() {
			this.$prizeList = $('.prize-list');
			this.$lis = this.$prizeList.find('.li');
			this.len = this.$lis.length;
			this.index = 2; //当前这张牌
			this.queueI = "";
			this.hasBeenSecret = []; //是否已展开过奖品
			this.isAnimating = false; //是否正有动画在执行
			this.times = {
				luckBtnTime: "", //抽奖按钮显示隐藏
				dragTime: "", //拖拽中奖人
				changeDelayTime: "", //等待显示中奖候选人
				changeParticipantTime: "", //改变显示的中奖候选人
				showPrizeUserTime: "", //翻转牌显示中奖人
				hideAllCardTime: "", //隐藏所有卡牌
				getAllAwarderTime: "" //查询阳光普照中奖人
			};
			this.instace = {};
			this.prizeUser = {}; //中奖人
			this.prizeList = {}; //奖品列表
			this.instace.mouseOffsetLeft = 0;
			this.instace.mouseOffsetTop = 0;
			this.mousePosition = {
				x: 0,
				y: 0
			};
			this.initTop = 0;
			this.isDrag = false; //是否正在拖拽
			this.canWheel = false; //是否可以滚动
			this.canMove = true; //是否可以移动
			this.ws = {}; //webSocket对象

			this.getPrize();

			for (var i = 0; i < this.len; i++) {
				this.$lis.eq(i).attr('data-index', i);
				this.$lis.eq(i).attr('data-queue-index', i);
				this.hasBeenSecret[i] = local.get('secret' + i) ? true : false;
				if (this.hasBeenSecret[i]) {
					this.$lis.eq(i).find('.front-wrap').remove();
				}
			}
			// 事件
			this.eve();
		}

		// 初始化事件
		Card.prototype.eve = function() {
			var that = this;
			//绑定每张牌的点击事件
			that.$prizeList.on('click', '.li', function(event) {
				event.preventDefault();
				var $this = $(this);
				that.index = $this.attr('data-index');
				that.queueI = $this.attr('data-queue-index');
				that.chooseCard($this);
			});

			//绑定当前牌的hover效果
			//必须用on去代理 mouseenter mouseleave事件
			that.$prizeList.on('mouseenter mouseleave', '.act', function(event) {
				event.preventDefault();
				event.stopPropagation();
				var $luckBtn = $(this).find('.luck-btn');

				if (event.type == "mouseenter") {
					clearTimeout(that.times.luckBtnTime);
					$luckBtn.css('display', 'block');
					$luckBtn.css('display');
					$luckBtn.css('opacity', 1);
				} else if (event.type == "mouseleave") {
					$luckBtn.css('opacity', 0);
					that.times.luckBtnTime = setTimeout(function() {
						$luckBtn.css('display', 'none');
					}, 600)
				}
			});

			// 绑定当前牌的按钮点击
			that.$prizeList.on('click', '.act .luck-btn', function(event) {
				event.preventDefault();
				event.stopPropagation();
				var time = "";
				var prizeLast = 100;
				that.canMove = false;
				if (that.index == 4) {
					// 阳光普照奖
					/*ajax(yearmeeting + 'rest/sun/sunState', {
						sunState: 'start'
					}, 'POST').done(function(res) {
						ajax(yearmeeting + 'rest/sun/allAwarder', {}, 'GET').done(function(res) {}
					}*/
					console.log('阳光普照已开启');
					that.times.getAllAwarderTime = setInterval(function() {
						var last = prizeLast-- < 0 ? 0 : prizeLast--;
						that.$lis.eq(4).find('.draw-num').text('还剩' + last + '名');
						if (last == 0) {
							clearInterval(that.times.getAllAwarderTime);
							// 恢复红包雨
							$('.hongbao').remove();
							clearInterval(snowTime);
							that.canMove = true;
						}
					}, 1000)
					$sun[0].volume = 0.8;
					$sun[0].play();
					that.showMask('.stage-mask');
					that.showMask('.sun-mask');
					$('.light1,.light-wrap').css('display', 'block');
					$('.light1,.light-wrap').css('display');
					$('.light1').addClass('open');
					$('.light2,.light3,.light4').addClass('go');
					setTimeout(function() {
						// 初始化红包雨
						init();
					}, 2000)
				} else {
					that.isAnimating = true;
					that.showMask('.prize-mask');
					that.showMask('.stage-mask');
					//短暂延迟后，牌旋转，并去请求接口
					that.getPrizeUser();
				}
			});

			// 查看中奖名单
			that.$prizeList.on('click', '.act .draw-num', function(event) {
				event.preventDefault();
				event.stopPropagation();
				that.gather();
			});

			// 隐藏prize遮罩
			$('.prize-mask').on('click', function(event) {
				event.preventDefault();
				//确认中奖人,然后隐藏prize-mask,隐藏中奖人
				that.hidePrizeUser();
			});

			// 隐藏stop-mask  并停止转动  显示中奖人
			$('.stop-mask').on('click', function(event) {
				event.preventDefault();
				that.showPrizeUser();
			});

			// 隐藏luck-mask 缓慢消失并在DOM上清除中奖人  缓慢显示当前卡牌
			$('.luck-mask').on('click', function(event) {
				event.preventDefault();
				that.timeToLottery(); //该抽奖了
			});

			// 隐藏阳光普照奖各种效果
			$('.sun-mask').on('click', function(event) {
				event.preventDefault();
				that.hideMask('.sun-mask');
				that.hideMask('.stage-mask');
				$('.light1,.light-wrap').css('display', 'none');
				$('.light1').removeClass('open');
				$('.light2,.light3,.light4').removeClass('go');
			});

			// 不设置stage-mask的点击效果，只作为禁止用户其他的操作用

			// 拖拽中奖人效果
			that.$prizeList.on('mousedown', '.act .avatar', function(event) {
				event.preventDefault();
				var moveEl = that.$lis.eq(that.index).find('.front-f');
				that.isDrag = true;
				// instace.mouseOffsetLeft = event.pageX - that.instace.moveEl.position().left;
				// 不考虑left，只做上下移动
				that.initTop = event.pageY;
				that.mousePosition.y = that.initTop; //初始化y
				that.instace.mouseOffsetTop = event.pageY - moveEl.offset().top;
				that.times.dragTime = setInterval(function() {
					that.dragMove();
				}, 16.7);
			});

			// 阻止头像上mouseup之后触发的click事件传播到父元素.li上
			that.$prizeList.on('click', '.act .avatar', function(event) {
				event.preventDefault();
				event.stopPropagation();
			})

			// 鼠标可能移出拖拽元素,需对document进行监听
			$(document).on('mousemove', function(event) {
				event.preventDefault();
				//只在拖拽开始后赋值
				if (that.isDrag) {
					that.mousePosition.x = event.pageX;
					that.mousePosition.y = event.pageY;
				}
			});

			$(document).on('mouseup', function(event) {
				event.preventDefault();
				clearInterval(that.times.dragTime);
				var moveEl = that.$lis.eq(that.index).find('.front-f');
				if (that.isDrag) {
					// 判断位移够不够
					var moveY = Math.abs(that.mousePosition.y - that.instace.mouseOffsetTop - 339);
					that.showMask('.stage-mask');
					if (moveY < 150) {
						moveEl.animate({
							top: 0,
							opacity: 1
						}, 200, function() {
							that.resetDrag();
							that.hideMask('.stage-mask');
						})
					} else {
						// 请求取消中奖人的接口
						that.hideMask('.prize-mask');
						that.hideMask('.stage-mask');
						/*ajax(api + 'rest/person', {
							userPhone: that.prizeUser.userPhone
						}, 'DELETE').done(function() {
							
						}).fail(function(err) {
							errMsg(err);
						});*/
						alert('已删除中奖人')
						// 不管成功与否都要执行  保证抽奖继续进行
						moveEl.animate({
							opacity: 0
						}, 200, function() {
							that.canMove = true;
							that.delPrize();
							that.resetDrag();
						})
					}
				}
				that.isDrag = false;
			});

			$(window).keydown(function(e) {
				e = window.event || e;
				var code = e.keyCode;

				// {1:keyCode→49,2:keyCode→50,3:keyCode→51,4:keyCode→52,5:keyCode→53}
				switch (code) {
					case 49:
						if (!that.canMove) return;
						that.index = 0;
						that.queueI = that.$lis.eq(that.index).attr('data-queue-index');
						var $el = that.$lis.eq(that.index);
						that.chooseCard($el);
						break;
					case 50:
						if (!that.canMove) return;
						that.index = 1;
						that.queueI = that.$lis.eq(that.index).attr('data-queue-index');
						var $el = that.$lis.eq(that.index);
						that.chooseCard($el);
						break;
					case 51:
						if (!that.canMove) return;
						that.index = 2;
						that.queueI = that.$lis.eq(that.index).attr('data-queue-index');
						var $el = that.$lis.eq(that.index);
						that.chooseCard($el);
						break;
					case 52:
						if (!that.canMove) return;
						that.index = 3;
						that.queueI = that.$lis.eq(that.index).attr('data-queue-index');
						var $el = that.$lis.eq(that.index);
						that.chooseCard($el);
						break;
					case 53:
						if (!that.canMove) return;
						that.index = 4;
						that.queueI = that.$lis.eq(that.index).attr('data-queue-index');
						var $el = that.$lis.eq(that.index);
						that.chooseCard($el);
						break;
					case 13:
						//
						break;
					case 82:
						// 恢复红包雨
						$('.hongbao').remove();
						clearInterval(snowTime);
						that.canMove = true;
						break;
					default:
						break;
				}
			})

			// 监听鼠标滚动事件
			document.addEventListener(mousewheel, function(e) {
				e = e || window.event;
				e.stopPropagation();
				e.preventDefault();
				if (that.canWheel) {
					that.canWheel = false;
					if (isFirefox) {
						if (e.detail == -3) {
							// 向上滚动  
							that.moveUp();
						} else {
							// 向下滚动  
							that.moveDown();
						}
					} else {
						if (e.wheelDelta == 120) {
							// 向上滚动  
							that.moveUp();
						} else {
							// 向上滚动  
							that.moveDown();
						}
					}
				} else {
					return;
				}
			}, false)

		}

		// 可请求奖品数据
		Card.prototype.getPrize = function() {
			var that = this;
			//请求数据
			/*ajax(yearmeeting + "rest/prize", {}, "GET").done(function(res) {
				that.prizeList = res.list;
				for (var i = 0; i < that.len; i++) {
					that.$lis.eq(i).find('.num').text(that.prizeList[i].drawNum);
					that.$lis.eq(i).attr('awardLevel', that.prizeList[i].awardLevel);
				}
			}).fail(function(err) {
				errMsg(err);
			})*/
			that.prizeList = local.get('prizeList') ? JSON.parse(local.get('prizeList')) : [{
		      	"awardLevel": 1,
		      	"awardName": "iPhone7",
		      	"drawNum": 0
		    }, {
		    	"awardLevel": 2,
		    	"awardName": "iPad",
		    	"drawNum": 0
		    }, {
		    	"awardLevel": 3,
		    	"awardName": "大行自行车",
		    	"drawNum": 0
		    }, {
		    	"awardLevel": 4,
		    	"awardName": "Kindle",
		    	"drawNum": 0
		    }, {
		    	"awardLevel": 5,
		    	"awardName": "50元红包",
		    	"drawNum": 0
		    }];

			for (var i = 0; i < that.len; i++) {
				that.$lis.eq(i).find('.num').text(that.prizeList[i].drawNum);
				that.$lis.eq(i).attr('awardLevel', that.prizeList[i].awardLevel);
			}
		}

		// 选中奖项
		Card.prototype.chooseCard = function(el) {
			var that = this
			if (that.isAnimating) {
				console.log("正在动画...");
				return;
			} else {
				if(el.hasClass('act')) return;
				// 设置执行动画
				that.isAnimating = true;
				that.showMask('.stage-mask');
				// 隐藏所有btn抽奖
				that.$lis.find('.luck-btn').css('display', 'none');
				if (that.hasBeenSecret[that.index]) {
					that.sortIndex();
				} else {
					local.set('secret' + that.index, true);
					that.hasBeenSecret[that.index] = true;
					that.showPrize();
				}
			}
		}

		// 展示奖品
		Card.prototype.showPrize = function() {
			var that = this;
			that.$lis.eq(that.index).find('.up').animate({
				'top': '-200px',
				'opacity': 0.5
			}, 720, function() {

			}).animate({
				'top': '-200px',
				'opacity': 0
			}, 80, function() {

			}).end().find('.down').animate({
				'top': '422px',
				'opacity': 0.5
			}, 720, function() {

			}).animate({
				'top': '422px',
				'opacity': 0.
			}, 80, function() {
				that.$lis.eq(that.index).find('.front-wrap').remove();
				that.sortIndex();
			})
		}

		// 重新排列queueIndex
		Card.prototype.sortIndex = function() {
			var that = this;
			var delt = that.queueI - 2; //正往左，负往右
			for (var i = 0; i < that.len; i++) {
				var oldQueneI = parseInt(that.$lis.eq(i).attr('data-queue-index'));
				if (delt == 1) {
					if (oldQueneI == 0) {
						that.$lis.eq(i).attr('data-queue-index', 4);
						that.changeZIndex(i);
					} else {
						that.$lis.eq(i).attr('data-queue-index', oldQueneI - 1);
					}
				} else if (delt == 2) {
					if (oldQueneI == 0) {
						that.$lis.eq(i).attr('data-queue-index', 3);
						that.changeZIndex(i);
					} else if (oldQueneI == 1) {
						that.$lis.eq(i).attr('data-queue-index', 4);
						that.changeZIndex(i);
					} else {
						that.$lis.eq(i).attr('data-queue-index', oldQueneI - 2);
					}
				} else if (delt == -1) {
					if (oldQueneI == 4) {
						that.$lis.eq(i).attr('data-queue-index', 0);
						that.changeZIndex(i);
					} else {
						that.$lis.eq(i).attr('data-queue-index', oldQueneI + 1);
					}
				} else if (delt == -2) {
					if (oldQueneI == 3) {
						that.$lis.eq(i).attr('data-queue-index', 0);
						that.changeZIndex(i);
					} else if (oldQueneI == 4) {
						that.$lis.eq(i).attr('data-queue-index', 1);
						that.changeZIndex(i);
					} else {
						that.$lis.eq(i).attr('data-queue-index', oldQueneI + 2);
					}
				} else if (delt == 0) {

				}
			}
			that.hideBlur();
			that.narrow();
			that.move();
		}

		// 各奖项移动
		Card.prototype.move = function() {
			var that = this;
			var time = "";
			for (var i = 0; i < that.len; i++) {
				var queueIndex = parseInt(that.$lis.eq(i).attr('data-queue-index'));
				that.$lis.eq(i).css('left', queueIndex * 340 + 80 * (queueIndex + 1) + 190 + 'px');
			}
			that.expand();
			time = setTimeout(function() {
				that.recoveryZIndex();
				that.isAnimating = false;
				that.showBlur();
				that.hideMask('.stage-mask');
				that.canMove = true;
			}, 610);
		}

		// 奖品放大
		Card.prototype.expand = function() {
			var that = this;
			that.$lis.eq(that.index).addClass('act');
			that.$lis.eq(that.index).css('left', '1050px');
		}

		// 奖品缩小
		Card.prototype.narrow = function() {
			var that = this;
			that.$lis.removeClass('act');
		}

		// 奖品缩成一团
		Card.prototype.gather = function() {
			var that = this;
			var $luckBtns = that.$lis.find('.luck-btn');
			var current = that.$lis.filter('.act');
			that.showMask('.stage-mask');
			that.showMask('.luck-mask');
			that.canWheel = false;
			that.canMove = false;
			/*ajax(api + 'rest/person', {
				awardLevel: current.attr('awardlevel')
			}, "GET").done(function(res) {
				if (res.awarderNum == 0) {
					that.hideMask('.stage-mask');
					that.hideMask('.luck-mask');
					return;
				} else {
					that.narrow();
					$('.n-title,.n-liao,.n-logos').toggleClass('hide');
					that.$lis.css('left', '1110px');
					$luckBtns.css({
						opacity: '0',
						display: 'none'
					});
					that.showAwards(res.awarderNum, res.list);
				}
			}).fail(function(err) {
				errMsg();
				that.hideMask('.stage-mask');
				that.hideMask('.luck-mask');
			});*/
			var awarderNum = 5;
			var list = [{
				userPhone: 18866669999,
				company: '宇宙公司',
				userName: 'cleinliy',
				userPic: '4.png'
			}, {
				userPhone: 18866669999,
				company: '宇宙公司',
				userName: 'cleinliy',
				userPic: '4.png'
			}, {
				userPhone: 18866669999,
				company: '宇宙公司',
				userName: 'cleinliy',
				userPic: '4.png'
			}, {
				userPhone: 18866669999,
				company: '宇宙公司',
				userName: 'cleinliy',
				userPic: '4.png'
			}, {
				userPhone: 18866669999,
				company: '宇宙公司',
				userName: 'cleinliy',
				userPic: '4.png'
			}]
			if (awarderNum == 0) {
				that.hideMask('.stage-mask');
				that.hideMask('.luck-mask');
				return;
			} else {
				that.narrow();
				$('.n-title,.n-liao,.n-logos').toggleClass('hide');
				that.$lis.css('left', '1110px');
				$luckBtns.css({
					opacity: '0',
					display: 'none'
				});
				that.showAwards(awarderNum, list);
			}
		}

		// 展示所有中奖人
		Card.prototype.showAwards = function(num, list) {
			var that = this;
			// num = 7;
			if (num == 0) return;
			var $container = $('.awarder-container');
			$container.css('display', 'block');
			var $moveContainer = $('.move-container');
			//牌距两边的留白150  140*4+150*2+340*5=2560
			//单层居中
			var tplStr =
				'<div class="awarder-wrap">' +
				'<div class="award-front">' +
				'<div class="avatar">' +
				'<img src="" alt="">' +
				'</div>' +
				'<div class="name"></div>' +
				'<div class="c-department"></div>' +
				'</div>' +
				'<div class="award-back"></div>' +
				'</div>';
			var halfWidth = 170,
				halfSpace = 70,
				blank = 150,
				leftArr = [
					[960],
					[720, 1200],
					[480, 960, 1440],
					[240, 720, 1200, 1680],
					[0, 480, 960, 1440, 1920]
				];
			var rules = [4, 4, 4, 5];
			var index = that.index; //哪个奖
			var range = rules[index]; //奖品等级单页展示个数
			var remainder = num % range; //余数
			var screenNum = Math.ceil(num / range); //需要几屏
			var screenNumTemp = screenNum;

			$moveContainer.css('height', 1024 * screenNum + 'px');

			for (var i = 0; i < num; i++) {
				var $el = $(tplStr).clone();
				$el.find('img').attr('src', 'images/avatar/' + list[i].userPic);
				$el.find('.name').text(list[i].userName);
				$el.find('.c-department').text(list[i].company + '-' + list[i].userPhone);
				$el.css({
					'transition-delay': 0.6 + i * 0.2 + 's',
					'webkit-transition-delay': 0.6 + i * 0.2 + 's'
				});
				$el.find('.award-front').css({
					'transition-delay': 0.6 + i * 0.2 + 's',
					'webkit-transition-delay': 0.6 + i * 0.2 + 's'
				});
				$el.find('.award-back').css({
					'transition-delay': 0.6 + i * 0.2 + 's',
					'webkit-transition-delay': 0.6 + i * 0.2 + 's'
				});
				$moveContainer.append($el);
			};

			that.times.showPrizeUserTime = setTimeout(function() {
				if (screenNum > 1) {
					screenNumTemp = remainder ? screenNum - 1 : screenNum;
					for (var i = 0; i < screenNumTemp; i++) {
						for (var j = 0; j < range; j++) {
							var $ele = $('.awarder-wrap').eq(i * range + j);
							$ele.css({
								'left': leftArr[range - 1][j] + blank + 'px',
								'top': i * 1024 + 265 + 'px'
							});
							turnAround($ele);
						};
					};
					for (var k = 0; k < remainder; k++) {
						var $ele = $('.awarder-wrap').eq(screenNumTemp * range + k);
						$ele.css({
							'left': leftArr[remainder - 1][k] + blank + 'px',
							'top': screenNumTemp * 1024 + 265 + 'px'
						});
						turnAround($ele);
					};
				}else{
					var len = remainder ? remainder : range;
					for (var k = 0; k < len; k++) {
						var $ele = $('.awarder-wrap').eq(k);
						$ele.css({
							'left': leftArr[len - 1][k] + blank + 'px',
							'top': '265px'
						});
						turnAround($ele);
					};
				}
			}, 400)

			// 隐藏卡牌集
			that.times.hideAllCardTime = setTimeout(function() {
				that.hideAllCard();
				that.hideMask('.stage-mask');
				if (screenNum == 0) {
					that.canWheel = false;
				} else {
					that.canWheel = true;
				}
				// 延迟换成0
				$('.awarder-wrap').css({
					'transition-delay': '0s',
					'webkit-transition-delay': '0s'
				});
			}, (0.6 + 0.6 + num * 0.2) * 1000); //排缩小需要0.6s，中奖人移动需要0.6s，每张牌间隔0.2s

			function turnAround(el) {
				el.find('.award-front').css({
					'transform': 'rotateY(0deg)',
					'-webkit-transform': 'rotateY(0deg)'
				});
				el.find('.award-back').css({
					'transform': 'rotateY(-180deg)',
					'-webkit-transform': 'rotateY(-180deg)'
				});
			}

		}

		// move-container向上滚动
		Card.prototype.moveUp = function() {
			var that = this;
			var height = parseInt($('.move-container').css('height'));
			var top = parseInt($('.move-container').css('top'));

			if (height == 1024) { //判断是否只有一页
				return;
			} else if (top == 0) { // 判断是否已经最上面一页
				that.canWheel = true;
				console.log('第一个了')
				return;
			} else {
				$('.move-container').animate({
					top: top + 1024 + 'px'
				}, 600, function() {
					that.canWheel = true;
				});
			}
		}

		// move-container向下滚动
		Card.prototype.moveDown = function() {
			var that = this;
			var height = parseInt($('.move-container').css('height'));
			var top = parseInt($('.move-container').css('top'));
			if (height == 1024) { //判断是否只有一页
				return;
			} else if (1024 - top == height) { // 判断是否已经最下面一页
				that.canWheel = true;
				console.log('最后一个了')
				return;
			} else {
				$('.move-container').animate({
					top: top - 1024 + 'px'
				}, 600, function() {
					that.canWheel = true;
				});
			}
		}

		// 该回到抽奖状态了
		Card.prototype.timeToLottery = function() {
			var that = this;
			that.hideMask('.luck-mask');
			that.showMask('.stage-mask');
			$('.n-title,.n-liao,.n-logos').toggleClass('hide');
			$('.awarder-wrap').css('opacity', '0');
			that.canWheel = false;
			clearTimeout(that.times.showPrizeUserTime);
			clearTimeout(that.times.hideAllCardTime);
			that.showAllCard();
			setTimeout(function() {
				that.move();
				$('.move-container').empty();
				$('.move-container').css({
					height: '1024px',
					top: '0px'
				});
			}, 600);
		}

		// 获取中奖人信息
		Card.prototype.getPrizeUser = function() {
			var that = this;
			var current = that.$lis.eq(that.index);
			var level = current.attr('awardLevel');
			$zhong[0].pause();
			$zhong[0].currentTime = 0.0;
			clearTimeout(that.times.hidePrizeUserTime);

			//请求中奖人 读取本地名单
			/*ajax(api + "rest/prize/" + level, {}, "GET").done(function(res) {
				that.showMask('.stop-mask');
				current.find('.front-f').css('display', 'block');
				that.prizeUser = res;
				that.spin(); //转牌
				$gu[0].play();

				that.times.changeDelayTime = setTimeout(function() {
					that.showParticipant(current);
					that.times.changeParticipantTime = setInterval(function() {
						that.showParticipant(current);
					}, 300)
				}, 150)

			}).fail(function(err) {
				// 都要隐藏，为了可以再次点击抽奖
				that.hideMask('.prize-mask');
				that.hideMask('.stage-mask');
				that.isAnimating = false;
				errMsg(err);
			})*/

			that.showMask('.stop-mask');
			current.find('.front-f').css('display', 'block');
			that.prizeUser = {
				userPhone: 18866669999,
				company: '宇宙公司',
				name: 'cleinliy',
				userPic: '4.png'
			};
			that.spin(); //转牌
			$gu[0].play();

			that.times.changeDelayTime = setTimeout(function() {
				that.showParticipant(current);
				that.times.changeParticipantTime = setInterval(function() {
					that.showParticipant(current);
				}, 300)
			}, 150)

			// 最好延迟0.5秒出现
			setTimeout(function() {
				current.find('.front-f').css('opacity', 1);
			}, 500);
		}

		// 改变z-index为1
		Card.prototype.changeZIndex = function(i) {
			var that = this;
			that.$lis.eq(i).css('z-index', 1);
		}

		// 恢复z-index为3
		Card.prototype.recoveryZIndex = function() {
			var that = this;
			that.$lis.css('z-index', 3);
			that.$lis.eq(that.index).css('z-index', 100);
		}

		// 显示遮罩
		// 2.prize-mask  用于确定中奖人信息
		// 3.stop-mask  用于停止转动中奖人信息
		// 4.stage-mask  用于阻止其他操作
		// 5.luck-mask  用于看完所有中奖人之后的隐藏
		Card.prototype.showMask = function(el) {
			$(el).css('display', 'block');
		}

		// 隐藏遮罩
		Card.prototype.hideMask = function(el) {
			$(el).css('display', 'none');
		}

		// 显示卡牌上的blur
		Card.prototype.showBlur = function() {
			var that = this;
			that.$lis.find('.front').addClass('blur');
			that.$lis.eq(that.index).find('.front').removeClass('blur');
		}

		// 隐藏卡牌上的blur
		Card.prototype.hideBlur = function() {
			var that = this;
			that.$lis.find('.front').removeClass('blur');
		}

		// 牌旋转
		Card.prototype.spin = function() {
			var that = this;
			var act = that.$lis.filter('.act');
			act.find('.front,.front-f,.back').addClass('spin');

		}

		// 牌停止
		Card.prototype.stopSpin = function() {
			var that = this;
			that.$lis.filter('.act').find('.front,.front-f,.back').removeClass('spin');
		}

		// 隐藏所有卡牌
		Card.prototype.hideAllCard = function() {
			var that = this;
			that.$lis.each(function(index, domEl) {
				$(domEl).css({
					'opacity': '0',
					'transform': 'translateY(30px)',
					'webkit-transform': 'translateY(30px)'
				});
			});
		}

		// 显示所有卡牌
		Card.prototype.showAllCard = function() {
			var that = this;
			that.$lis.each(function(index, domEl) {
				$(domEl).css({
					opacity: '1',
					'transform': 'translateY(0px)',
					'webkit-transform': 'translateY(0px)'
				});
			});
		}

		// 展示中奖人
		Card.prototype.showPrizeUser = function() {

			/*ajax(api + 'rest/prize', {}, 'PUT').done(function(res) {

			})*/
			$gu[0].pause();
			$gu[0].currentTime = 0.0;
			$zhong[0].play();
			var that = this;
			var current = that.$lis.eq(that.index);
			var department = "";
			clearTimeout(that.times.changeDelayTime);
			clearInterval(that.times.changeParticipantTime);
			department = that.prizeUser.company + '-' + that.prizeUser.userPhone;

			that.hideMask('.stop-mask');
			current.find('.avatar img').attr('src', 'images/avatar/' + that.prizeUser.userPic);
			current.find('.name').text(that.prizeUser.name);
			current.find('.c-department').text(department);

			that.hideMask('.stage-mask');
			that.isAnimating = false;
			that.stopSpin();
		}

		// 展示候选人
		Card.prototype.showParticipant = function(current) {
			var that = this;
			var random = Math.floor(Math.random() * 10);
			current.find('.avatar img').attr('src', 'images/avatar/' + random + '.png');
		}

		// 隐藏中奖人
		Card.prototype.hidePrizeUser = function() {
			var that = this;
			var current = that.$lis.eq(that.index);

			that.hideMask('.prize-mask');
			that.showMask('.stage-mask');
			current.find('.front-f').addClass('hide');
			// 重新请求奖品相关数据
			that.getPrize();
			that.times.hidePrizeUserTime = setTimeout(function() {
				that.canMove = true;
				that.delPrize();
				that.hideMask('.stage-mask');
			}, 1000);
		}

		// 清除中奖人信息
		Card.prototype.delPrize = function() {
			var that = this;
			var current = that.$lis.eq(that.index);
			current.find('.front-f').css({
				'display': 'none',
				'opacity': 0
			});
			current.find('.front-f').css('top', '0');
			current.find('.avatar img').attr('src', '');
			current.find('.name').text('');
			current.find('.c-department').text('');
			current.find('.front-f').removeClass('hide');
		}

		// 拖拽中奖人
		Card.prototype.dragMove = function() {
			var that = this;
			var moveEl = that.$lis.eq(that.index).find('.front-f');
			// 对Y轴不作边界限制
			var moveY = that.mousePosition.y - that.initTop;
			// 339是div.li距离顶部的距离
			var elTop = that.mousePosition.y - that.instace.mouseOffsetTop - 339;
			var x = Math.abs(elTop);

			if (x >= 250) {
				x = 250;
			}
			moveEl.css({
				top: elTop + 'px',
				opacity: Math.min(1, 1 - 0.004 * x)
			});
		}

		// 重置drag
		Card.prototype.resetDrag = function() {
			var that = this;
			that.instace.mouseOffsetLeft = 0;
			that.instace.mouseOffsetTop = 0;
			that.mousePosition = {
				x: 0,
				y: 0
			};
			that.initTop = 0;
			that.times.dragTime = "";
			that.isDrag = false;
		}

		return Card;
	})()

	var card = new Card();

});
(function (window, document, $, undefined) {
  "use strict";
  if (!$) {
    return undefined;
  }
  var defaults = {
    speed: 330,
    loop: true,
    opacity: "auto",
    margin: [44, 0],
    gutter: 30,
    infobar: true,
    buttons: true,
    slideShow: true,
    fullScreen: true,
    thumbs: true,
    closeBtn: true,
    smallBtn: "auto",
    image: { preload: "auto", protect: false },
    ajax: { settings: { data: { fancybox: true } } },
    iframe: {
      tpl: '<iframe id="fancybox-frame{rnd}" name="fancybox-frame{rnd}" class="fancybox-iframe" frameborder="0" vspace="0" hspace="0" webkitAllowFullScreen mozallowfullscreen allowFullScreen allowtransparency="true" src=""></iframe>',
      preload: true,
      scrolling: "no",
      css: {},
    },
    baseClass: "",
    slideClass: "",
    baseTpl:
      '<div class="fancybox-container" role="dialog" tabindex="-1">' +
      '<div class="fancybox-bg"></div>' +
      '<div class="fancybox-controls">' +
      '<div class="fancybox-infobar">' +
      '<button data-fancybox-previous class="fancybox-button fancybox-button--left" title="Previous"></button>' +
      '<div class="fancybox-infobar__body">' +
      '<span class="js-fancybox-index"></span>&nbsp;/&nbsp;<span class="js-fancybox-count"></span>' +
      "</div>" +
      '<button data-fancybox-next class="fancybox-button fancybox-button--right" title="Next"></button>' +
      "</div>" +
      '<div class="fancybox-buttons">' +
      '<button data-fancybox-close class="fancybox-button fancybox-button--close" title="Close (Esc)"></button>' +
      "</div>" +
      "</div>" +
      '<div class="fancybox-slider-wrap">' +
      '<div class="fancybox-slider"></div>' +
      "</div>" +
      '<div class="fancybox-caption-wrap"><div class="fancybox-caption"></div></div>' +
      "</div>",
    spinnerTpl: '<div class="fancybox-loading"></div>',
    errorTpl:
      '<div class="fancybox-error"><p>The requested content cannot be loaded. <br /> Please try again later.<p></div>',
    closeTpl:
      '<button data-fancybox-close class="fancybox-close-small"></button>',
    parentEl: "body",
    touch: true,
    keyboard: true,
    focus: true,
    closeClickOutside: true,
    beforeLoad: $.noop,
    afterLoad: $.noop,
    beforeMove: $.noop,
    afterMove: $.noop,
    onComplete: $.noop,
    onInit: $.noop,
    beforeClose: $.noop,
    afterClose: $.noop,
    onActivate: $.noop,
    onDeactivate: $.noop,
  };
  var $W = $(window);
  var $D = $(document);
  var called = 0;
  var isQuery = function (obj) {
    return obj && obj.hasOwnProperty && obj instanceof $;
  };
  var requestAFrame = (function () {
    return (
      window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      function (callback) {
        window.setTimeout(callback, 1000 / 60);
      }
    );
  })();
  var isElementInViewport = function (el) {
    var rect;
    if (typeof $ === "function" && el instanceof $) {
      el = el[0];
    }
    rect = el.getBoundingClientRect();
    return (
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.left < (window.innerWidth || document.documentElement.clientWidth) &&
      rect.top < (window.innerHeight || document.documentElement.clientHeight)
    );
  };
  var FancyBox = function (content, opts, index) {
    var self = this;
    self.opts = $.extend(true, { index: index }, defaults, opts || {});
    self.id = self.opts.id || ++called;
    self.group = [];
    self.currIndex = parseInt(self.opts.index, 10) || 0;
    self.prevIndex = null;
    self.prevPos = null;
    self.currPos = 0;
    self.firstRun = null;
    self.createGroup(content);
    if (!self.group.length) {
      return;
    }
    self.$lastFocus = $(document.activeElement).blur();
    self.slides = {};
    self.init(content);
  };
  $.extend(FancyBox.prototype, {
    init: function () {
      var self = this;
      var galleryHasHtml = false;
      var testWidth;
      var $container;
      self.scrollTop = $D.scrollTop();
      self.scrollLeft = $D.scrollLeft();
      if (!$.fancybox.getInstance()) {
        testWidth = $("body").width();
        $("html").addClass("fancybox-enabled");
        if ($.fancybox.isTouch) {
          $.each(self.group, function (key, item) {
            if (item.type !== "image" && item.type !== "iframe") {
              galleryHasHtml = true;
              return false;
            }
          });
          if (galleryHasHtml) {
            $("body").css({
              position: "fixed",
              width: testWidth,
              top: self.scrollTop * -1,
            });
          }
        } else {
          testWidth = $("body").width() - testWidth;
          if (testWidth > 1) {
            $('<style id="fancybox-noscroll" type="text/css">')
              .html(
                ".compensate-for-scrollbar, .fancybox-enabled body { margin-right: " +
                  testWidth +
                  "px; }"
              )
              .appendTo("head");
          }
        }
      }
      $container = $(self.opts.baseTpl)
        .attr("id", "fancybox-container-" + self.id)
        .data("FancyBox", self)
        .addClass(self.opts.baseClass)
        .hide()
        .prependTo(self.opts.parentEl);
      self.$refs = {
        container: $container,
        bg: $container.find(".fancybox-bg"),
        controls: $container.find(".fancybox-controls"),
        buttons: $container.find(".fancybox-buttons"),
        slider_wrap: $container.find(".fancybox-slider-wrap"),
        slider: $container.find(".fancybox-slider"),
        caption: $container.find(".fancybox-caption"),
      };
      self.trigger("onInit");
      self.activate();
      if (self.current) {
        return;
      }
      self.jumpTo(self.currIndex);
    },
    createGroup: function (content) {
      var self = this;
      var items = $.makeArray(content);
      $.each(items, function (i, item) {
        var obj = {},
          opts = {},
          data = [],
          $item,
          type,
          src,
          srcParts;
        if ($.isPlainObject(item)) {
          obj = item;
          opts = item.opts || {};
        } else if ($.type(item) === "object" && $(item).length) {
          $item = $(item);
          data = $item.data();
          opts = "options" in data ? data.options : {};
          opts = $.type(opts) === "object" ? opts : {};
          obj.type = "type" in data ? data.type : opts.type;
          obj.src = "src" in data ? data.src : opts.src || $item.attr("href");
          opts.width = "width" in data ? data.width : opts.width;
          opts.height = "height" in data ? data.height : opts.height;
          opts.thumb = "thumb" in data ? data.thumb : opts.thumb;
          opts.selector = "selector" in data ? data.selector : opts.selector;
          if ("srcset" in data) {
            opts.image = { srcset: data.srcset };
          }
          opts.$orig = $item;
        } else {
          obj = { type: "html", content: item + "" };
        }
        obj.opts = $.extend(true, {}, self.opts, opts);
        type = obj.type;
        src = obj.src || "";
        if (!type) {
          if (obj.content) {
            type = "html";
          } else if (
            src.match(
              /(^data:image\/[a-z0-9+\/=]*,)|(\.(jp(e|g|eg)|gif|png|bmp|webp|svg|ico)((\?|#).*)?$)/i
            )
          ) {
            type = "image";
          } else if (src.match(/\.(pdf)((\?|#).*)?$/i)) {
            type = "pdf";
          } else if (src.charAt(0) === "#") {
            type = "inline";
          }
          obj.type = type;
        }
        obj.index = self.group.length;
        if (obj.opts.$orig && !obj.opts.$orig.length) {
          delete obj.opts.$orig;
        }
        if (!obj.opts.$thumb && obj.opts.$orig) {
          obj.opts.$thumb = obj.opts.$orig.find("img:first");
        }
        if (obj.opts.$thumb && !obj.opts.$thumb.length) {
          delete obj.opts.$thumb;
        }
        if ($.type(obj.opts.caption) === "function") {
          obj.opts.caption = obj.opts.caption.apply(item, [self, obj]);
        } else if ("caption" in data) {
          obj.opts.caption = data.caption;
        } else if (opts.$orig) {
          obj.opts.caption = $item.attr("title");
        }
        obj.opts.caption =
          obj.opts.caption === undefined ? "" : obj.opts.caption + "";
        if (type === "ajax") {
          srcParts = src.split(/\s+/, 2);
          if (srcParts.length > 1) {
            obj.src = srcParts.shift();
            obj.opts.selector = srcParts.shift();
          }
        }
        if (obj.opts.smallBtn == "auto") {
          if ($.inArray(type, ["html", "inline", "ajax"]) > -1) {
            obj.opts.buttons = false;
            obj.opts.smallBtn = true;
          } else {
            obj.opts.smallBtn = false;
          }
        }
        if (type === "pdf") {
          obj.type = "iframe";
          obj.opts.closeBtn = true;
          obj.opts.smallBtn = false;
          obj.opts.iframe.preload = false;
        }
        if (obj.opts.modal) {
          $.extend(true, obj.opts, {
            infobar: 0,
            buttons: 0,
            keyboard: 0,
            slideShow: 0,
            fullScreen: 0,
            closeClickOutside: 0,
          });
        }
        self.group.push(obj);
      });
    },
    addEvents: function () {
      var self = this;
      self.removeEvents();
      self.$refs.container
        .on("click.fb-close", "[data-fancybox-close]", function (e) {
          e.stopPropagation();
          e.preventDefault();
          self.close(e);
        })
        .on("click.fb-previous", "[data-fancybox-previous]", function (e) {
          e.stopPropagation();
          e.preventDefault();
          self.previous();
        })
        .on("click.fb-next", "[data-fancybox-next]", function (e) {
          e.stopPropagation();
          e.preventDefault();
          self.next();
        });
      $(window).on("orientationchange.fb resize.fb", function (e) {
        requestAFrame(function () {
          if (e && e.originalEvent && e.originalEvent.type === "resize") {
            self.update();
          } else {
            self.$refs.slider_wrap.hide();
            requestAFrame(function () {
              self.$refs.slider_wrap.show();
              self.update();
            });
          }
        });
      });
      $D.on("focusin.fb", function (e) {
        var instance = $.fancybox ? $.fancybox.getInstance() : null;
        if (
          instance &&
          !$(e.target).hasClass("fancybox-container") &&
          !$.contains(instance.$refs.container[0], e.target)
        ) {
          e.stopPropagation();
          instance.focus();
          $W.scrollTop(self.scrollTop).scrollLeft(self.scrollLeft);
        }
      });
      $D.on("keydown.fb", function (e) {
        var current = self.current,
          keycode = e.keyCode || e.which;
        if (!current || !current.opts.keyboard) {
          return;
        }
        if ($(e.target).is("input") || $(e.target).is("textarea")) {
          return;
        }
        if (keycode === 8 || keycode === 27) {
          e.preventDefault();
          self.close(e);
          return;
        }
        switch (keycode) {
          case 37:
          case 38:
            e.preventDefault();
            self.previous();
            break;
          case 39:
          case 40:
            e.preventDefault();
            self.next();
            break;
          case 80:
          case 32:
            e.preventDefault();
            if (self.SlideShow) {
              e.preventDefault();
              self.SlideShow.toggle();
            }
            break;
          case 70:
            if (self.FullScreen) {
              e.preventDefault();
              self.FullScreen.toggle();
            }
            break;
          case 71:
            if (self.Thumbs) {
              e.preventDefault();
              self.Thumbs.toggle();
            }
            break;
        }
      });
    },
    removeEvents: function () {
      $W.off("scroll.fb resize.fb orientationchange.fb");
      $D.off("keydown.fb focusin.fb click.fb-close");
      this.$refs.container.off(
        "click.fb-close click.fb-previous click.fb-next"
      );
    },
    previous: function (duration) {
      this.jumpTo(this.currIndex - 1, duration);
    },
    next: function (duration) {
      this.jumpTo(this.currIndex + 1, duration);
    },
    jumpTo: function (to, duration) {
      var self = this,
        firstRun,
        index,
        pos,
        loop;
      firstRun = self.firstRun = self.firstRun === null;
      index = pos = to = parseInt(to, 10);
      loop = self.current ? self.current.opts.loop : false;
      if (self.isAnimating || (index == self.currIndex && !firstRun)) {
        return;
      }
      if (self.group.length > 1 && loop) {
        index = index % self.group.length;
        index = index < 0 ? self.group.length + index : index;
        if (self.group.length == 2) {
          pos = to - self.currIndex + self.currPos;
        } else {
          pos = index - self.currIndex + self.currPos;
          if (
            Math.abs(self.currPos - (pos + self.group.length)) <
            Math.abs(self.currPos - pos)
          ) {
            pos = pos + self.group.length;
          } else if (
            Math.abs(self.currPos - (pos - self.group.length)) <
            Math.abs(self.currPos - pos)
          ) {
            pos = pos - self.group.length;
          }
        }
      } else if (!self.group[index]) {
        self.update(false, false, duration);
        return;
      }
      if (self.current) {
        self.current.$slide.removeClass(
          "fancybox-slide--current fancybox-slide--complete"
        );
        self.updateSlide(self.current, true);
      }
      self.prevIndex = self.currIndex;
      self.prevPos = self.currPos;
      self.currIndex = index;
      self.currPos = pos;
      self.current = self.createSlide(pos);
      if (self.group.length > 1) {
        if (self.opts.loop || pos - 1 >= 0) {
          self.createSlide(pos - 1);
        }
        if (self.opts.loop || pos + 1 < self.group.length) {
          self.createSlide(pos + 1);
        }
      }
      self.current.isMoved = false;
      self.current.isComplete = false;
      duration = parseInt(
        duration === undefined ? self.current.opts.speed * 1.5 : duration,
        10
      );
      self.trigger("beforeMove");
      self.updateControls();
      if (firstRun) {
        self.current.$slide.addClass("fancybox-slide--current");
        self.$refs.container.show();
        requestAFrame(function () {
          self.$refs.bg.css(
            "transition-duration",
            self.current.opts.speed + "ms"
          );
          self.$refs.container.addClass("fancybox-container--ready");
        });
      }
      self.update(true, false, firstRun ? 0 : duration, function () {
        self.afterMove();
      });
      self.loadSlide(self.current);
      if (!(firstRun && self.current.$ghost)) {
        self.preload();
      }
    },
    createSlide: function (pos) {
      var self = this;
      var $slide;
      var index;
      var found;
      index = pos % self.group.length;
      index = index < 0 ? self.group.length + index : index;
      if (!self.slides[pos] && self.group[index]) {
        if (self.opts.loop && self.group.length > 2) {
          for (var key in self.slides) {
            if (self.slides[key].index === index) {
              found = self.slides[key];
              found.pos = pos;
              self.slides[pos] = found;
              delete self.slides[key];
              self.updateSlide(found);
              return found;
            }
          }
        }
        $slide = $('<div class="fancybox-slide"></div>').appendTo(
          self.$refs.slider
        );
        self.slides[pos] = $.extend(true, {}, self.group[index], {
          pos: pos,
          $slide: $slide,
          isMoved: false,
          isLoaded: false,
        });
      }
      return self.slides[pos];
    },
    zoomInOut: function (type, duration, callback) {
      var self = this;
      var current = self.current;
      var $what = current.$placeholder;
      var opacity = current.opts.opacity;
      var $thumb = current.opts.$thumb;
      var thumbPos = $thumb ? $thumb.offset() : 0;
      var slidePos = current.$slide.offset();
      var props;
      var start;
      var end;
      if (
        !$what ||
        !current.isMoved ||
        !thumbPos ||
        !isElementInViewport($thumb)
      ) {
        return false;
      }
      if (type === "In" && !self.firstRun) {
        return false;
      }
      $.fancybox.stop($what);
      self.isAnimating = true;
      props = {
        top:
          thumbPos.top -
          slidePos.top +
          parseFloat($thumb.css("border-top-width") || 0),
        left:
          thumbPos.left -
          slidePos.left +
          parseFloat($thumb.css("border-left-width") || 0),
        width: $thumb.width(),
        height: $thumb.height(),
        scaleX: 1,
        scaleY: 1,
      };
      if (opacity == "auto") {
        opacity =
          Math.abs(
            current.width / current.height - props.width / props.height
          ) > 0.1;
      }
      if (type === "In") {
        start = props;
        end = self.getFitPos(current);
        end.scaleX = end.width / start.width;
        end.scaleY = end.height / start.height;
        if (opacity) {
          start.opacity = 0.1;
          end.opacity = 1;
        }
      } else {
        start = $.fancybox.getTranslate($what);
        end = props;
        if (current.$ghost) {
          current.$ghost.show();
          if (current.$image) {
            current.$image.remove();
          }
        }
        start.scaleX = start.width / end.width;
        start.scaleY = start.height / end.height;
        start.width = end.width;
        start.height = end.height;
        if (opacity) {
          end.opacity = 0;
        }
      }
      self.updateCursor(end.width, end.height);
      delete end.width;
      delete end.height;
      $.fancybox.setTranslate($what, start);
      $what.show();
      self.trigger("beforeZoom" + type);
      $what.css("transition", "all " + duration + "ms");
      $.fancybox.setTranslate($what, end);
      setTimeout(function () {
        var reset;
        $what.css("transition", "none");
        reset = $.fancybox.getTranslate($what);
        reset.scaleX = 1;
        reset.scaleY = 1;
        $.fancybox.setTranslate($what, reset);
        self.trigger("afterZoom" + type);
        callback.apply(self);
        self.isAnimating = false;
      }, duration);
      return true;
    },
    canPan: function () {
      var self = this;
      var current = self.current;
      var $what = current.$placeholder;
      var rez = false;
      if ($what) {
        rez = self.getFitPos(current);
        rez =
          Math.abs($what.width() - rez.width) > 1 ||
          Math.abs($what.height() - rez.height) > 1;
      }
      return rez;
    },
    isScaledDown: function () {
      var self = this;
      var current = self.current;
      var $what = current.$placeholder;
      var rez = false;
      if ($what) {
        rez = $.fancybox.getTranslate($what);
        rez = rez.width < current.width || rez.height < current.height;
      }
      return rez;
    },
    scaleToActual: function (x, y, duration) {
      var self = this;
      var current = self.current;
      var $what = current.$placeholder;
      var imgPos, posX, posY, scaleX, scaleY;
      var canvasWidth = parseInt(current.$slide.width(), 10);
      var canvasHeight = parseInt(current.$slide.height(), 10);
      var newImgWidth = current.width;
      var newImgHeight = current.height;
      if (!$what) {
        return;
      }
      self.isAnimating = true;
      x = x === undefined ? canvasWidth * 0.5 : x;
      y = y === undefined ? canvasHeight * 0.5 : y;
      imgPos = $.fancybox.getTranslate($what);
      scaleX = newImgWidth / imgPos.width;
      scaleY = newImgHeight / imgPos.height;
      posX = canvasWidth * 0.5 - newImgWidth * 0.5;
      posY = canvasHeight * 0.5 - newImgHeight * 0.5;
      if (newImgWidth > canvasWidth) {
        posX = imgPos.left * scaleX - (x * scaleX - x);
        if (posX > 0) {
          posX = 0;
        }
        if (posX < canvasWidth - newImgWidth) {
          posX = canvasWidth - newImgWidth;
        }
      }
      if (newImgHeight > canvasHeight) {
        posY = imgPos.top * scaleY - (y * scaleY - y);
        if (posY > 0) {
          posY = 0;
        }
        if (posY < canvasHeight - newImgHeight) {
          posY = canvasHeight - newImgHeight;
        }
      }
      self.updateCursor(newImgWidth, newImgHeight);
      $.fancybox.animate(
        $what,
        null,
        { top: posY, left: posX, scaleX: scaleX, scaleY: scaleY },
        duration || current.opts.speed,
        function () {
          self.isAnimating = false;
        }
      );
    },
    scaleToFit: function (duration) {
      var self = this;
      var current = self.current;
      var $what = current.$placeholder;
      var end;
      if (!$what) {
        return;
      }
      self.isAnimating = true;
      end = self.getFitPos(current);
      self.updateCursor(end.width, end.height);
      $.fancybox.animate(
        $what,
        null,
        {
          top: end.top,
          left: end.left,
          scaleX: end.width / $what.width(),
          scaleY: end.height / $what.height(),
        },
        duration || current.opts.speed,
        function () {
          self.isAnimating = false;
        }
      );
    },
    getFitPos: function (slide) {
      var $what = slide.$placeholder || slide.$content;
      var imgWidth = slide.width;
      var imgHeight = slide.height;
      var margin = slide.opts.margin;
      var canvasWidth, canvasHeight, minRatio, top, left, width, height;
      if (!$what || !$what.length || (!imgWidth && !imgHeight)) {
        return false;
      }
      if ($.type(margin) === "number") {
        margin = [margin, margin];
      }
      if (margin.length == 2) {
        margin = [margin[0], margin[1], margin[0], margin[1]];
      }
      if ($W.width() < 800) {
        margin = [0, 0, 0, 0];
      }
      canvasWidth =
        parseInt(slide.$slide.width(), 10) - (margin[1] + margin[3]);
      canvasHeight =
        parseInt(slide.$slide.height(), 10) - (margin[0] + margin[2]);
      minRatio = Math.min(1, canvasWidth / imgWidth, canvasHeight / imgHeight);
      width = Math.floor(minRatio * imgWidth);
      height = Math.floor(minRatio * imgHeight);
      top = Math.floor((canvasHeight - height) * 0.5) + margin[0];
      left = Math.floor((canvasWidth - width) * 0.5) + margin[3];
      return { top: top, left: left, width: width, height: height };
    },
    update: function (andSlides, andContent, duration, callback) {
      var self = this;
      var leftValue;
      if (self.isAnimating === true || !self.current) {
        return;
      }
      leftValue =
        self.current.pos * Math.floor(self.current.$slide.width()) * -1 -
        self.current.pos * self.current.opts.gutter;
      duration = parseInt(duration, 10) || 0;
      $.fancybox.stop(self.$refs.slider);
      if (andSlides === false) {
        self.updateSlide(self.current, andContent);
      } else {
        $.each(self.slides, function (key, slide) {
          self.updateSlide(slide, andContent);
        });
      }
      if (duration) {
        $.fancybox.animate(
          self.$refs.slider,
          null,
          { top: 0, left: leftValue },
          duration,
          function () {
            self.current.isMoved = true;
            if ($.type(callback) === "function") {
              callback.apply(self);
            }
          }
        );
      } else {
        $.fancybox.setTranslate(self.$refs.slider, { top: 0, left: leftValue });
        self.current.isMoved = true;
        if ($.type(callback) === "function") {
          callback.apply(self);
        }
      }
    },
    updateSlide: function (slide, andContent) {
      var self = this;
      var $what = slide.$placeholder;
      var leftPos;
      slide = slide || self.current;
      if (!slide || self.isClosing) {
        return;
      }
      leftPos =
        slide.pos * Math.floor(slide.$slide.width()) +
        slide.pos * slide.opts.gutter;
      if (leftPos !== slide.leftPos) {
        $.fancybox.setTranslate(slide.$slide, { top: 0, left: leftPos });
        slide.leftPos = leftPos;
      }
      if (andContent !== false && $what) {
        $.fancybox.setTranslate($what, self.getFitPos(slide));
        if (slide.pos === self.currPos) {
          self.updateCursor();
        }
      }
      slide.$slide.trigger("refresh");
      self.trigger("onUpdate", slide);
    },
    updateCursor: function (nextWidth, nextHeight) {
      var self = this;
      var canScale;
      var $container = self.$refs.container.removeClass(
        "fancybox-controls--canzoomIn fancybox-controls--canzoomOut fancybox-controls--canGrab"
      );
      if (self.isClosing || !self.opts.touch) {
        return;
      }
      if (nextWidth !== undefined && nextHeight !== undefined) {
        canScale =
          nextWidth < self.current.width && nextHeight < self.current.height;
      } else {
        canScale = self.isScaledDown();
      }
      if (canScale) {
        $container.addClass("fancybox-controls--canzoomIn");
      } else if (self.group.length < 2) {
        $container.addClass("fancybox-controls--canzoomOut");
      } else {
        $container.addClass("fancybox-controls--canGrab");
      }
    },
    loadSlide: function (slide) {
      var self = this,
        type,
        $slide;
      var ajaxLoad;
      if (!slide || slide.isLoaded || slide.isLoading) {
        return;
      }
      slide.isLoading = true;
      self.trigger("beforeLoad", slide);
      type = slide.type;
      $slide = slide.$slide;
      $slide
        .off("refresh")
        .trigger("onReset")
        .addClass("fancybox-slide--" + (type || "unknown"))
        .addClass(slide.opts.slideClass);
      switch (type) {
        case "image":
          self.setImage(slide);
          break;
        case "iframe":
          self.setIframe(slide);
          break;
        case "html":
          self.setContent(slide, slide.content);
          break;
        case "inline":
          if ($(slide.src).length) {
            self.setContent(slide, $(slide.src));
          } else {
            self.setError(slide);
          }
          break;
        case "ajax":
          self.showLoading(slide);
          ajaxLoad = $.ajax(
            $.extend({}, slide.opts.ajax.settings, {
              url: slide.src,
              success: function (data, textStatus) {
                if (textStatus === "success") {
                  self.setContent(slide, data);
                }
              },
              error: function (jqXHR, textStatus) {
                if (jqXHR && textStatus !== "abort") {
                  self.setError(slide);
                }
              },
            })
          );
          $slide.one("onReset", function () {
            ajaxLoad.abort();
          });
          break;
        default:
          self.setError(slide);
          break;
      }
      return true;
    },
    setImage: function (slide) {
      var self = this;
      var srcset = slide.opts.image.srcset;
      var found, temp, pxRatio, windowWidth;
      if (slide.isLoaded && !slide.hasError) {
        self.afterLoad(slide);
        return;
      }
      if (srcset) {
        pxRatio = window.devicePixelRatio || 1;
        windowWidth = window.innerWidth * pxRatio;
        temp = srcset.split(",").map(function (el) {
          var ret = {};
          el.trim()
            .split(/\s+/)
            .forEach(function (el, i) {
              var value = parseInt(el.substring(0, el.length - 1), 10);
              if (i === 0) {
                return (ret.url = el);
              }
              if (value) {
                ret.value = value;
                ret.postfix = el[el.length - 1];
              }
            });
          return ret;
        });
        temp.sort(function (a, b) {
          return a.value - b.value;
        });
        for (var j = 0; j < temp.length; j++) {
          var el = temp[j];
          if (
            (el.postfix === "w" && el.value >= windowWidth) ||
            (el.postfix === "x" && el.value >= pxRatio)
          ) {
            found = el;
            break;
          }
        }
        if (!found && temp.length) {
          found = temp[temp.length - 1];
        }
        if (found) {
          slide.src = found.url;
          if (slide.width && slide.height && found.postfix == "w") {
            slide.height = (slide.width / slide.height) * found.value;
            slide.width = found.value;
          }
        }
      }
      slide.$placeholder = $('<div class="fancybox-placeholder"></div>')
        .hide()
        .appendTo(slide.$slide);
      if (
        slide.opts.preload !== false &&
        slide.opts.width &&
        slide.opts.height &&
        (slide.opts.thumb || slide.opts.$thumb)
      ) {
        slide.width = slide.opts.width;
        slide.height = slide.opts.height;
        slide.$ghost = $("<img />")
          .one("load error", function () {
            if (self.isClosing) {
              return;
            }
            $("<img/>")[0].src = slide.src;
            self.revealImage(slide, function () {
              self.setBigImage(slide);
              if (self.firstRun && slide.index === self.currIndex) {
                self.preload();
              }
            });
          })
          .addClass("fancybox-image")
          .appendTo(slide.$placeholder)
          .attr("src", slide.opts.thumb || slide.opts.$thumb.attr("src"));
      } else {
        self.setBigImage(slide);
      }
    },
    setBigImage: function (slide) {
      var self = this;
      var $img = $("<img />");
      slide.$image = $img
        .one("error", function () {
          self.setError(slide);
        })
        .one("load", function () {
          clearTimeout(slide.timouts);
          slide.timouts = null;
          if (self.isClosing) {
            return;
          }
          slide.width = this.naturalWidth;
          slide.height = this.naturalHeight;
          if (slide.opts.image.srcset) {
            $img.attr("sizes", "100vw").attr("srcset", slide.opts.image.srcset);
          }
          self.afterLoad(slide);
          if (slide.$ghost) {
            slide.timouts = setTimeout(function () {
              slide.$ghost.hide();
            }, 350);
          }
        })
        .addClass("fancybox-image")
        .attr("src", slide.src)
        .appendTo(slide.$placeholder);
      if ($img[0].complete) {
        $img.trigger("load");
      } else if ($img[0].error) {
        $img.trigger("error");
      } else {
        slide.timouts = setTimeout(function () {
          if (!$img[0].complete && !slide.hasError) {
            self.showLoading(slide);
          }
        }, 150);
      }
      if (slide.opts.image.protect) {
        $('<div class="fancybox-spaceball"></div>')
          .appendTo(slide.$placeholder)
          .on("contextmenu.fb", function (e) {
            if (e.button == 2) {
              e.preventDefault();
            }
            return true;
          });
      }
    },
    revealImage: function (slide, callback) {
      var self = this;
      callback = callback || $.noop;
      if (
        slide.type !== "image" ||
        slide.hasError ||
        slide.isRevealed === true
      ) {
        callback.apply(self);
        return;
      }
      slide.isRevealed = true;
      if (
        !(
          slide.pos === self.currPos &&
          self.zoomInOut("In", slide.opts.speed, callback)
        )
      ) {
        if (slide.$ghost && !slide.isLoaded) {
          self.updateSlide(slide, true);
        }
        if (slide.pos === self.currPos) {
          $.fancybox.animate(
            slide.$placeholder,
            { opacity: 0 },
            { opacity: 1 },
            300,
            callback
          );
        } else {
          slide.$placeholder.show();
        }
        callback.apply(self);
      }
    },
    setIframe: function (slide) {
      var self = this,
        opts = slide.opts.iframe,
        $slide = slide.$slide,
        $iframe;
      slide.$content = $('<div class="fancybox-content"></div>')
        .css(opts.css)
        .appendTo($slide);
      $iframe = $(opts.tpl.replace(/\{rnd\}/g, new Date().getTime()))
        .attr("scrolling", $.fancybox.isTouch ? "auto" : opts.scrolling)
        .appendTo(slide.$content);
      if (opts.preload) {
        slide.$content.addClass("fancybox-tmp");
        self.showLoading(slide);
        $iframe.on("load.fb error.fb", function (e) {
          this.isReady = 1;
          slide.$slide.trigger("refresh");
          self.afterLoad(slide);
        });
        $slide.on("refresh.fb", function () {
          var $wrap = slide.$content,
            $contents,
            $body,
            scrollWidth,
            frameWidth,
            frameHeight;
          if ($iframe[0].isReady !== 1) {
            return;
          }
          try {
            $contents = $iframe.contents();
            $body = $contents.find("body");
          } catch (ignore) {}
          if (
            $body &&
            $body.length &&
            !(opts.css.width !== undefined && opts.css.height !== undefined)
          ) {
            scrollWidth =
              $iframe[0].contentWindow.document.documentElement.scrollWidth;
            frameWidth = Math.ceil(
              $body.outerWidth(true) + ($wrap.width() - scrollWidth)
            );
            frameHeight = Math.ceil($body.outerHeight(true));
            $wrap.css({
              width:
                opts.css.width === undefined
                  ? frameWidth + ($wrap.outerWidth() - $wrap.innerWidth())
                  : opts.css.width,
              height:
                opts.css.height === undefined
                  ? frameHeight + ($wrap.outerHeight() - $wrap.innerHeight())
                  : opts.css.height,
            });
          }
          $wrap.removeClass("fancybox-tmp");
        });
      } else {
        this.afterLoad(slide);
      }
      $iframe.attr("src", slide.src);
      if (slide.opts.smallBtn) {
        slide.$content.prepend(slide.opts.closeTpl);
      }
      $slide.one("onReset", function () {
        try {
          $(this).find("iframe").hide().attr("src", "//about:blank");
        } catch (ignore) {}
        $(this).empty();
        slide.isLoaded = false;
      });
    },
    setContent: function (slide, content) {
      var self = this;
      if (self.isClosing) {
        return;
      }
      self.hideLoading(slide);
      slide.$slide.empty();
      if (isQuery(content) && content.parent().length) {
        if (content.data("placeholder")) {
          content.parents(".fancybox-slide").trigger("onReset");
        }
        content
          .data({ placeholder: $("<div></div>").hide().insertAfter(content) })
          .css("display", "inline-block");
      } else {
        if ($.type(content) === "string") {
          content = $("<div>").append(content).contents();
          if (content[0].nodeType === 3) {
            content = $("<div>").html(content);
          }
        }
        if (slide.opts.selector) {
          content = $("<div>").html(content).find(slide.opts.selector);
        }
      }
      slide.$slide.one("onReset", function () {
        var placeholder = isQuery(content) ? content.data("placeholder") : 0;
        if (placeholder) {
          content.hide().replaceAll(placeholder);
          content.data("placeholder", null);
        }
        if (!slide.hasError) {
          $(this).empty();
          slide.isLoaded = false;
        }
      });
      slide.$content = $(content).appendTo(slide.$slide);
      if (slide.opts.smallBtn === true) {
        slide.$content
          .find(".fancybox-close-small")
          .remove()
          .end()
          .eq(0)
          .append(slide.opts.closeTpl);
      }
      this.afterLoad(slide);
    },
    setError: function (slide) {
      slide.hasError = true;
      this.setContent(slide, slide.opts.errorTpl);
    },
    showLoading: function (slide) {
      var self = this;
      slide = slide || self.current;
      if (slide && !slide.$spinner) {
        slide.$spinner = $(self.opts.spinnerTpl).appendTo(slide.$slide);
      }
    },
    hideLoading: function (slide) {
      var self = this;
      slide = slide || self.current;
      if (slide && slide.$spinner) {
        slide.$spinner.remove();
        delete slide.$spinner;
      }
    },
    afterMove: function () {
      var self = this;
      var current = self.current;
      var slides = {};
      if (!current) {
        return;
      }
      current.$slide.siblings().trigger("onReset");
      $.each(self.slides, function (key, slide) {
        if (slide.pos >= self.currPos - 1 && slide.pos <= self.currPos + 1) {
          slides[slide.pos] = slide;
        } else if (slide) {
          slide.$slide.remove();
        }
      });
      self.slides = slides;
      self.trigger("afterMove");
      if (current.isLoaded) {
        self.complete();
      }
    },
    afterLoad: function (slide) {
      var self = this;
      if (self.isClosing) {
        return;
      }
      slide.isLoading = false;
      slide.isLoaded = true;
      self.trigger("afterLoad", slide);
      self.hideLoading(slide);
      if (!slide.$ghost) {
        self.updateSlide(slide, true);
      }
      if (slide.index === self.currIndex && slide.isMoved) {
        self.complete();
      } else if (!slide.$ghost) {
        self.revealImage(slide);
      }
    },
    complete: function () {
      var self = this;
      var current = self.current;
      self.revealImage(current, function () {
        current.isComplete = true;
        current.$slide.addClass("fancybox-slide--complete");
        self.updateCursor();
        self.trigger("onComplete");
        if (
          current.opts.focus &&
          !(current.type === "image" || current.type === "iframe")
        ) {
          self.focus();
        }
      });
    },
    preload: function () {
      var self = this;
      var next, prev;
      if (self.group.length < 2) {
        return;
      }
      next = self.slides[self.currPos + 1];
      prev = self.slides[self.currPos - 1];
      if (next && next.type === "image") {
        self.loadSlide(next);
      }
      if (prev && prev.type === "image") {
        self.loadSlide(prev);
      }
    },
    focus: function () {
      var current = this.current;
      var $el;
      $el =
        current && current.isComplete
          ? current.$slide
              .find('button,:input,[tabindex],a:not(".disabled")')
              .filter(":visible:first")
          : null;
      if (!$el || !$el.length) {
        $el = this.$refs.container;
      }
      $el.focus();
      this.$refs.slider_wrap.scrollLeft(0);
      if (current) {
        current.$slide.scrollTop(0);
      }
    },
    activate: function () {
      var self = this;
      $(".fancybox-container").each(function () {
        var instance = $(this).data("FancyBox");
        if (instance && instance.uid !== self.uid && !instance.isClosing) {
          instance.trigger("onDeactivate");
        }
      });
      if (self.current) {
        if (self.$refs.container.index() > 0) {
          self.$refs.container.prependTo(document.body);
        }
        self.updateControls();
      }
      self.trigger("onActivate");
      self.addEvents();
    },
    close: function (e) {
      var self = this;
      var current = self.current;
      var duration = current.opts.speed;
      var done = $.proxy(function () {
        self.cleanUp(e);
      }, this);
      if (self.isAnimating || self.isClosing) {
        return false;
      }
      if (self.trigger("beforeClose", e) === false) {
        $.fancybox.stop(self.$refs.slider);
        requestAFrame(function () {
          self.update(true, true, 150);
        });
        return;
      }
      self.isClosing = true;
      if (current.timouts) {
        clearTimeout(current.timouts);
      }
      if (e !== true) {
        $.fancybox.stop(self.$refs.slider);
      }
      self.$refs.container
        .removeClass("fancybox-container--active")
        .addClass("fancybox-container--closing");
      current.$slide
        .removeClass("fancybox-slide--complete")
        .siblings()
        .remove();
      if (!current.isMoved) {
        current.$slide.css("overflow", "visible");
      }
      self.removeEvents();
      self.hideLoading(current);
      self.hideControls();
      self.updateCursor();
      self.$refs.bg.css("transition-duration", duration + "ms");
      this.$refs.container.removeClass("fancybox-container--ready");
      if (e === true) {
        setTimeout(done, duration);
      } else if (!self.zoomInOut("Out", duration, done)) {
        $.fancybox.animate(
          self.$refs.container,
          null,
          { opacity: 0 },
          duration,
          "easeInSine",
          done
        );
      }
    },
    cleanUp: function (e) {
      var self = this,
        instance;
      self.$refs.slider.children().trigger("onReset");
      self.$refs.container.empty().remove();
      self.trigger("afterClose", e);
      self.current = null;
      instance = $.fancybox.getInstance();
      if (instance) {
        instance.activate();
      } else {
        $("html").removeClass("fancybox-enabled");
        $("body").removeAttr("style");
        $W.scrollTop(self.scrollTop).scrollLeft(self.scrollLeft);
        $("#fancybox-noscroll").remove();
      }
      if (self.$lastFocus) {
        self.$lastFocus.focus();
      }
    },
    trigger: function (name, slide) {
      var args = Array.prototype.slice.call(arguments, 1),
        self = this,
        obj = slide && slide.opts ? slide : self.current,
        rez;
      if (obj) {
        args.unshift(obj);
      } else {
        obj = self;
      }
      args.unshift(self);
      if ($.isFunction(obj.opts[name])) {
        rez = obj.opts[name].apply(obj, args);
      }
      if (rez === false) {
        return rez;
      }
      if (name === "afterClose") {
        $(document).trigger(name + ".fb", args);
      } else {
        self.$refs.container.trigger(name + ".fb", args);
      }
    },
    toggleControls: function (force) {
      if (this.isHiddenControls) {
        this.updateControls(force);
      } else {
        this.hideControls();
      }
    },
    hideControls: function () {
      this.isHiddenControls = true;
      this.$refs.container.removeClass("fancybox-show-controls");
      this.$refs.container.removeClass("fancybox-show-caption");
    },
    updateControls: function (force) {
      var self = this;
      var $container = self.$refs.container;
      var $caption = self.$refs.caption;
      var current = self.current;
      var index = current.index;
      var opts = current.opts;
      var caption = opts.caption;
      if (this.isHiddenControls && force !== true) {
        return;
      }
      this.isHiddenControls = false;
      $container
        .addClass("fancybox-show-controls")
        .toggleClass(
          "fancybox-show-infobar",
          !!opts.infobar && self.group.length > 1
        )
        .toggleClass("fancybox-show-buttons", !!opts.buttons)
        .toggleClass("fancybox-is-modal", !!opts.modal);
      $(".fancybox-button--left", $container).toggleClass(
        "fancybox-button--disabled",
        !opts.loop && index <= 0
      );
      $(".fancybox-button--right", $container).toggleClass(
        "fancybox-button--disabled",
        !opts.loop && index >= self.group.length - 1
      );
      $(".fancybox-button--play", $container).toggle(
        !!(opts.slideShow && self.group.length > 1)
      );
      $(".fancybox-button--close", $container).toggle(!!opts.closeBtn);
      $(".js-fancybox-count", $container).html(self.group.length);
      $(".js-fancybox-index", $container).html(index + 1);
      current.$slide.trigger("refresh");
      if ($caption) {
        $caption.empty();
      }
      if (caption && caption.length) {
        $caption.html(caption);
        this.$refs.container.addClass("fancybox-show-caption ");
        self.$caption = $caption;
      } else {
        this.$refs.container.removeClass("fancybox-show-caption");
      }
    },
  });
  $.fancybox = {
    version: "3.0.47",
    defaults: defaults,
    getInstance: function (command) {
      var instance = $(
        '.fancybox-container:not(".fancybox-container--closing"):first'
      ).data("FancyBox");
      var args = Array.prototype.slice.call(arguments, 1);
      if (instance instanceof FancyBox) {
        if ($.type(command) === "string") {
          instance[command].apply(instance, args);
        } else if ($.type(command) === "function") {
          command.apply(instance, args);
        }
        return instance;
      }
      return false;
    },
    open: function (items, opts, index) {
      return new FancyBox(items, opts, index);
    },
    close: function (all) {
      var instance = this.getInstance();
      if (instance) {
        instance.close();
        if (all === true) {
          this.close();
        }
      }
    },
    isTouch:
      document.createTouch !== undefined &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent),
    use3d: (function () {
      var div = document.createElement("div");
      return (
        window.getComputedStyle(div).getPropertyValue("transform") &&
        !(document.documentMode && document.documentMode <= 11)
      );
    })(),
    getTranslate: function ($el) {
      var position, matrix;
      if (!$el || !$el.length) {
        return false;
      }
      position = $el.get(0).getBoundingClientRect();
      matrix = $el.eq(0).css("transform");
      if (matrix && matrix.indexOf("matrix") !== -1) {
        matrix = matrix.split("(")[1];
        matrix = matrix.split(")")[0];
        matrix = matrix.split(",");
      } else {
        matrix = [];
      }
      if (matrix.length) {
        if (matrix.length > 10) {
          matrix = [matrix[13], matrix[12], matrix[0], matrix[5]];
        } else {
          matrix = [matrix[5], matrix[4], matrix[0], matrix[3]];
        }
        matrix = matrix.map(parseFloat);
      } else {
        matrix = [0, 0, 1, 1];
      }
      return {
        top: matrix[0],
        left: matrix[1],
        scaleX: matrix[2],
        scaleY: matrix[3],
        opacity: parseFloat($el.css("opacity")),
        width: position.width,
        height: position.height,
      };
    },
    setTranslate: function ($el, props) {
      var str = "";
      var css = {};
      if (!$el || !props) {
        return;
      }
      if (props.left !== undefined || props.top !== undefined) {
        str =
          (props.left === undefined ? $el.position().top : props.left) +
          "px, " +
          (props.top === undefined ? $el.position().top : props.top) +
          "px";
        if (this.use3d) {
          str = "translate3d(" + str + ", 0px)";
        } else {
          str = "translate(" + str + ")";
        }
      }
      if (props.scaleX !== undefined && props.scaleY !== undefined) {
        str =
          (str.length ? str + " " : "") +
          "scale(" +
          props.scaleX +
          ", " +
          props.scaleY +
          ")";
      }
      if (str.length) {
        css.transform = str;
      }
      if (props.opacity !== undefined) {
        css.opacity = props.opacity;
      }
      if (props.width !== undefined) {
        css.width = props.width;
      }
      if (props.height !== undefined) {
        css.height = props.height;
      }
      return $el.css(css);
    },
    easing: {
      easeOutCubic: function (t, b, c, d) {
        return c * ((t = t / d - 1) * t * t + 1) + b;
      },
      easeInCubic: function (t, b, c, d) {
        return c * (t /= d) * t * t + b;
      },
      easeOutSine: function (t, b, c, d) {
        return c * Math.sin((t / d) * (Math.PI / 2)) + b;
      },
      easeInSine: function (t, b, c, d) {
        return -c * Math.cos((t / d) * (Math.PI / 2)) + c + b;
      },
    },
    stop: function ($el) {
      $el.removeData("animateID");
    },
    animate: function ($el, from, to, duration, easing, done) {
      var self = this;
      var lastTime = null;
      var animTime = 0;
      var curr;
      var diff;
      var id;
      var finish = function () {
        if (
          to.scaleX !== undefined &&
          to.scaleY !== undefined &&
          from &&
          from.width !== undefined &&
          from.height !== undefined
        ) {
          to.width = from.width * to.scaleX;
          to.height = from.height * to.scaleY;
          to.scaleX = 1;
          to.scaleY = 1;
        }
        self.setTranslate($el, to);
        done();
      };
      var frame = function (timestamp) {
        curr = [];
        diff = 0;
        if (!$el.length || $el.data("animateID") !== id) {
          return;
        }
        timestamp = timestamp || Date.now();
        if (lastTime) {
          diff = timestamp - lastTime;
        }
        lastTime = timestamp;
        animTime += diff;
        if (animTime >= duration) {
          finish();
          return;
        }
        for (var prop in to) {
          if (to.hasOwnProperty(prop) && from[prop] !== undefined) {
            if (from[prop] == to[prop]) {
              curr[prop] = to[prop];
            } else {
              curr[prop] = self.easing[easing](
                animTime,
                from[prop],
                to[prop] - from[prop],
                duration
              );
            }
          }
        }
        self.setTranslate($el, curr);
        requestAFrame(frame);
      };
      self.animateID = id =
        self.animateID === undefined ? 1 : self.animateID + 1;
      $el.data("animateID", id);
      if (done === undefined && $.type(easing) == "function") {
        done = easing;
        easing = undefined;
      }
      if (!easing) {
        easing = "easeOutCubic";
      }
      done = done || $.noop;
      if (from) {
        this.setTranslate($el, from);
      } else {
        from = this.getTranslate($el);
      }
      if (duration) {
        $el.show();
        requestAFrame(frame);
      } else {
        finish();
      }
    },
  };
  function _run(e) {
    var target = e.currentTarget,
      opts = e.data ? e.data.options : {},
      items = e.data ? e.data.items : [],
      value = "",
      index = 0;
    e.preventDefault();
    e.stopPropagation();
    if ($(target).attr("data-fancybox")) {
      value = $(target).data("fancybox");
    }
    if (value) {
      items = items.length
        ? items.filter('[data-fancybox="' + value + '"]')
        : $("[data-fancybox=" + value + "]");
      index = items.index(target);
    } else {
      items = [target];
    }
    $.fancybox.open(items, opts, index);
  }
  $.fn.fancybox = function (options) {
    this.off("click.fb-start").on(
      "click.fb-start",
      { items: this, options: options || {} },
      _run
    );
    return this;
  };
  $(document).on("click.fb-start", "[data-fancybox]", _run);
})(window, document, window.jQuery);
(function ($) {
  "use strict";
  var format = function (url, rez, params) {
    if (!url) {
      return;
    }
    params = params || "";
    if ($.type(params) === "object") {
      params = $.param(params, true);
    }
    $.each(rez, function (key, value) {
      url = url.replace("$" + key, value || "");
    });
    if (params.length) {
      url += (url.indexOf("?") > 0 ? "&" : "?") + params;
    }
    return url;
  };
  var media = {
    youtube: {
      matcher:
        /(youtube\.com|youtu\.be|youtube\-nocookie\.com)\/(watch\?(.*&)?v=|v\/|u\/|embed\/?)?(videoseries\?list=(.*)|[\w-]{11}|\?listType=(.*)&list=(.*))(.*)/i,
      params: {
        autoplay: 1,
        autohide: 1,
        fs: 1,
        rel: 0,
        hd: 1,
        wmode: "transparent",
        enablejsapi: 1,
        html5: 1,
      },
      paramPlace: 8,
      type: "iframe",
      url: "//www.youtube.com/embed/$4",
      thumb: "//img.youtube.com/vi/$4/hqdefault.jpg",
    },
    vimeo: {
      matcher: /^.+vimeo.com\/(.*\/)?([\d]+)(.*)?/,
      params: {
        autoplay: 1,
        hd: 1,
        show_title: 1,
        show_byline: 1,
        show_portrait: 0,
        fullscreen: 1,
        api: 1,
      },
      paramPlace: 3,
      type: "iframe",
      url: "//player.vimeo.com/video/$2",
    },
    metacafe: {
      matcher: /metacafe.com\/watch\/(\d+)\/(.*)?/,
      type: "iframe",
      url: "//www.metacafe.com/embed/$1/?ap=1",
    },
    dailymotion: {
      matcher: /dailymotion.com\/video\/(.*)\/?(.*)/,
      params: { additionalInfos: 0, autoStart: 1 },
      type: "iframe",
      url: "//www.dailymotion.com/embed/video/$1",
    },
    vine: {
      matcher: /vine.co\/v\/([a-zA-Z0-9\?\=\-]+)/,
      type: "iframe",
      url: "//vine.co/v/$1/embed/simple",
    },
    instagram: {
      matcher: /(instagr\.am|instagram\.com)\/p\/([a-zA-Z0-9_\-]+)\/?/i,
      type: "image",
      url: "//$1/p/$2/media/?size=l",
    },
    google_maps: {
      matcher:
        /(maps\.)?google\.([a-z]{2,3}(\.[a-z]{2})?)\/(((maps\/(place\/(.*)\/)?\@(.*),(\d+.?\d+?)z))|(\?ll=))(.*)?/i,
      type: "iframe",
      url: function (rez) {
        return (
          "//maps.google." +
          rez[2] +
          "/?ll=" +
          (rez[9]
            ? rez[9] +
              "&z=" +
              Math.floor(rez[10]) +
              (rez[12] ? rez[12].replace(/^\//, "&") : "")
            : rez[12]) +
          "&output=" +
          (rez[12] && rez[12].indexOf("layer=c") > 0 ? "svembed" : "embed")
        );
      },
    },
  };
  $(document).on("onInit.fb", function (e, instance) {
    $.each(instance.group, function (i, item) {
      var url = item.src || "",
        type = false,
        thumb,
        rez,
        params,
        urlParams,
        o,
        provider;
      if (item.type) {
        return;
      }
      $.each(media, function (n, el) {
        rez = url.match(el.matcher);
        o = {};
        provider = n;
        if (!rez) {
          return;
        }
        type = el.type;
        if (el.paramPlace && rez[el.paramPlace]) {
          urlParams = rez[el.paramPlace];
          if (urlParams[0] == "?") {
            urlParams = urlParams.substring(1);
          }
          urlParams = urlParams.split("&");
          for (var m = 0; m < urlParams.length; ++m) {
            var p = urlParams[m].split("=", 2);
            if (p.length == 2) {
              o[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
            }
          }
        }
        params = $.extend(true, {}, el.params, item.opts[n], o);
        url =
          $.type(el.url) === "function"
            ? el.url.call(this, rez, params, item)
            : format(el.url, rez, params);
        thumb =
          $.type(el.thumb) === "function"
            ? el.thumb.call(this, rez, params, item)
            : format(el.thumb, rez);
        if (provider === "vimeo") {
          url = url.replace("&%23", "#");
        }
        return false;
      });
      if (type) {
        item.src = url;
        item.type = type;
        if (
          !item.opts.thumb &&
          !(item.opts.$thumb && item.opts.$thumb.length)
        ) {
          item.opts.thumb = thumb;
        }
        if (type === "iframe") {
          $.extend(true, item.opts, {
            iframe: { preload: false, scrolling: "no" },
            smallBtn: false,
            closeBtn: true,
            fullScreen: false,
            slideShow: false,
          });
          item.opts.slideClass += " fancybox-slide--video";
        }
      } else {
        item.type = "iframe";
      }
    });
  });
})(window.jQuery);
(function (window, document, $) {
  "use strict";
  var requestAFrame = (function () {
    return (
      window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      function (callback) {
        window.setTimeout(callback, 1000 / 60);
      }
    );
  })();
  var pointers = function (e) {
    var result = [];
    e = e.originalEvent || e || window.e;
    e =
      e.touches && e.touches.length
        ? e.touches
        : e.changedTouches && e.changedTouches.length
        ? e.changedTouches
        : [e];
    for (var key in e) {
      if (e[key].pageX) {
        result.push({ x: e[key].pageX, y: e[key].pageY });
      } else if (e[key].clientX) {
        result.push({ x: e[key].clientX, y: e[key].clientY });
      }
    }
    return result;
  };
  var distance = function (point2, point1, what) {
    if (!point1 || !point2) {
      return 0;
    }
    if (what === "x") {
      return point2.x - point1.x;
    } else if (what === "y") {
      return point2.y - point1.y;
    }
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
    );
  };
  var isClickable = function ($el) {
    return (
      $el.is("a") ||
      $el.is("button") ||
      $el.is("input") ||
      $el.is("select") ||
      $el.is("textarea") ||
      $.isFunction($el.get(0).onclick)
    );
  };
  var hasScrollbars = function (el) {
    var overflowY = window.getComputedStyle(el)["overflow-y"];
    var overflowX = window.getComputedStyle(el)["overflow-x"];
    var vertical =
      (overflowY === "scroll" || overflowY === "auto") &&
      el.scrollHeight > el.clientHeight;
    var horizontal =
      (overflowX === "scroll" || overflowX === "auto") &&
      el.scrollWidth > el.clientWidth;
    return vertical || horizontal;
  };
  var isScrollable = function ($el) {
    var rez = false;
    while (true) {
      rez = hasScrollbars($el.get(0));
      if (rez) {
        break;
      }
      $el = $el.parent();
      if (!$el.length || $el.hasClass("fancybox-slider") || $el.is("body")) {
        break;
      }
    }
    return rez;
  };
  var Guestures = function (instance) {
    var self = this;
    self.instance = instance;
    self.$wrap = instance.$refs.slider_wrap;
    self.$slider = instance.$refs.slider;
    self.$container = instance.$refs.container;
    self.destroy();
    self.$wrap.on("touchstart.fb mousedown.fb", $.proxy(self, "ontouchstart"));
  };
  Guestures.prototype.destroy = function () {
    this.$wrap.off(
      "touchstart.fb mousedown.fb touchmove.fb mousemove.fb touchend.fb touchcancel.fb mouseup.fb mouseleave.fb"
    );
  };
  Guestures.prototype.ontouchstart = function (e) {
    var self = this;
    var $target = $(e.target);
    var instance = self.instance;
    var current = instance.current;
    var $content = current.$content || current.$placeholder;
    self.startPoints = pointers(e);
    self.$target = $target;
    self.$content = $content;
    self.canvasWidth = Math.round(current.$slide[0].clientWidth);
    self.canvasHeight = Math.round(current.$slide[0].clientHeight);
    self.startEvent = e;
    if (
      e.originalEvent.clientX >
      self.canvasWidth + current.$slide.offset().left
    ) {
      return true;
    }
    if (
      isClickable($target) ||
      isClickable($target.parent()) ||
      isScrollable($target)
    ) {
      return;
    }
    if (!current.opts.touch) {
      self.endPoints = self.startPoints;
      return self.ontap();
    }
    if (e.originalEvent && e.originalEvent.button == 2) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    if (!current || self.instance.isAnimating || self.instance.isClosing) {
      return;
    }
    if (
      !self.startPoints ||
      (self.startPoints.length > 1 && !current.isMoved)
    ) {
      return;
    }
    self.$wrap.off("touchmove.fb mousemove.fb", $.proxy(self, "ontouchmove"));
    self.$wrap.off(
      "touchend.fb touchcancel.fb mouseup.fb mouseleave.fb",
      $.proxy(self, "ontouchend")
    );
    self.$wrap.on(
      "touchend.fb touchcancel.fb mouseup.fb mouseleave.fb",
      $.proxy(self, "ontouchend")
    );
    self.$wrap.on("touchmove.fb mousemove.fb", $.proxy(self, "ontouchmove"));
    self.startTime = new Date().getTime();
    self.distanceX = self.distanceY = self.distance = 0;
    self.canTap = false;
    self.isPanning = false;
    self.isSwiping = false;
    self.isZooming = false;
    self.sliderStartPos = $.fancybox.getTranslate(self.$slider);
    self.contentStartPos = $.fancybox.getTranslate(self.$content);
    self.contentLastPos = null;
    if (self.startPoints.length === 1 && !self.isZooming) {
      self.canTap = current.isMoved;
      if (
        current.type === "image" &&
        (self.contentStartPos.width > self.canvasWidth + 1 ||
          self.contentStartPos.height > self.canvasHeight + 1)
      ) {
        $.fancybox.stop(self.$content);
        self.isPanning = true;
      } else {
        $.fancybox.stop(self.$slider);
        self.isSwiping = true;
      }
      self.$container.addClass("fancybox-controls--isGrabbing");
    }
    if (
      self.startPoints.length === 2 &&
      current.isMoved &&
      !current.hasError &&
      current.type === "image" &&
      (current.isLoaded || current.$ghost)
    ) {
      self.isZooming = true;
      self.isSwiping = false;
      self.isPanning = false;
      $.fancybox.stop(self.$content);
      self.centerPointStartX =
        (self.startPoints[0].x + self.startPoints[1].x) * 0.5 -
        $(window).scrollLeft();
      self.centerPointStartY =
        (self.startPoints[0].y + self.startPoints[1].y) * 0.5 -
        $(window).scrollTop();
      self.percentageOfImageAtPinchPointX =
        (self.centerPointStartX - self.contentStartPos.left) /
        self.contentStartPos.width;
      self.percentageOfImageAtPinchPointY =
        (self.centerPointStartY - self.contentStartPos.top) /
        self.contentStartPos.height;
      self.startDistanceBetweenFingers = distance(
        self.startPoints[0],
        self.startPoints[1]
      );
    }
  };
  Guestures.prototype.ontouchmove = function (e) {
    var self = this;
    e.preventDefault();
    self.newPoints = pointers(e);
    if (!self.newPoints || !self.newPoints.length) {
      return;
    }
    self.distanceX = distance(self.newPoints[0], self.startPoints[0], "x");
    self.distanceY = distance(self.newPoints[0], self.startPoints[0], "y");
    self.distance = distance(self.newPoints[0], self.startPoints[0]);
    if (self.distance > 0) {
      if (self.isSwiping) {
        self.onSwipe();
      } else if (self.isPanning) {
        self.onPan();
      } else if (self.isZooming) {
        self.onZoom();
      }
    }
  };
  Guestures.prototype.onSwipe = function () {
    var self = this;
    var swiping = self.isSwiping;
    var left = self.sliderStartPos.left;
    var angle;
    if (swiping === true) {
      if (Math.abs(self.distance) > 10) {
        if (self.instance.group.length < 2) {
          self.isSwiping = "y";
        } else if (
          !self.instance.current.isMoved ||
          self.instance.opts.touch.vertical === false ||
          (self.instance.opts.touch.vertical === "auto" &&
            $(window).width() > 800)
        ) {
          self.isSwiping = "x";
        } else {
          angle = Math.abs(
            (Math.atan2(self.distanceY, self.distanceX) * 180) / Math.PI
          );
          self.isSwiping = angle > 45 && angle < 135 ? "y" : "x";
        }
        self.canTap = false;
        self.instance.current.isMoved = false;
        self.startPoints = self.newPoints;
      }
    } else {
      if (swiping == "x") {
        if (
          !self.instance.current.opts.loop &&
          self.instance.current.index === 0 &&
          self.distanceX > 0
        ) {
          left = left + Math.pow(self.distanceX, 0.8);
        } else if (
          !self.instance.current.opts.loop &&
          self.instance.current.index === self.instance.group.length - 1 &&
          self.distanceX < 0
        ) {
          left = left - Math.pow(-self.distanceX, 0.8);
        } else {
          left = left + self.distanceX;
        }
      }
      self.sliderLastPos = {
        top: swiping == "x" ? 0 : self.sliderStartPos.top + self.distanceY,
        left: left,
      };
      requestAFrame(function () {
        $.fancybox.setTranslate(self.$slider, self.sliderLastPos);
      });
    }
  };
  Guestures.prototype.onPan = function () {
    var self = this;
    var newOffsetX, newOffsetY, newPos;
    self.canTap = false;
    if (self.contentStartPos.width > self.canvasWidth) {
      newOffsetX = self.contentStartPos.left + self.distanceX;
    } else {
      newOffsetX = self.contentStartPos.left;
    }
    newOffsetY = self.contentStartPos.top + self.distanceY;
    newPos = self.limitMovement(
      newOffsetX,
      newOffsetY,
      self.contentStartPos.width,
      self.contentStartPos.height
    );
    newPos.scaleX = self.contentStartPos.scaleX;
    newPos.scaleY = self.contentStartPos.scaleY;
    self.contentLastPos = newPos;
    requestAFrame(function () {
      $.fancybox.setTranslate(self.$content, self.contentLastPos);
    });
  };
  Guestures.prototype.limitMovement = function (
    newOffsetX,
    newOffsetY,
    newWidth,
    newHeight
  ) {
    var self = this;
    var minTranslateX, minTranslateY, maxTranslateX, maxTranslateY;
    var canvasWidth = self.canvasWidth;
    var canvasHeight = self.canvasHeight;
    var currentOffsetX = self.contentStartPos.left;
    var currentOffsetY = self.contentStartPos.top;
    var distanceX = self.distanceX;
    var distanceY = self.distanceY;
    minTranslateX = Math.max(0, canvasWidth * 0.5 - newWidth * 0.5);
    minTranslateY = Math.max(0, canvasHeight * 0.5 - newHeight * 0.5);
    maxTranslateX = Math.min(
      canvasWidth - newWidth,
      canvasWidth * 0.5 - newWidth * 0.5
    );
    maxTranslateY = Math.min(
      canvasHeight - newHeight,
      canvasHeight * 0.5 - newHeight * 0.5
    );
    if (newWidth > canvasWidth) {
      if (distanceX > 0 && newOffsetX > minTranslateX) {
        newOffsetX =
          minTranslateX -
            1 +
            Math.pow(-minTranslateX + currentOffsetX + distanceX, 0.8) || 0;
      }
      if (distanceX < 0 && newOffsetX < maxTranslateX) {
        newOffsetX =
          maxTranslateX +
            1 -
            Math.pow(maxTranslateX - currentOffsetX - distanceX, 0.8) || 0;
      }
    }
    if (newHeight > canvasHeight) {
      if (distanceY > 0 && newOffsetY > minTranslateY) {
        newOffsetY =
          minTranslateY -
            1 +
            Math.pow(-minTranslateY + currentOffsetY + distanceY, 0.8) || 0;
      }
      if (distanceY < 0 && newOffsetY < maxTranslateY) {
        newOffsetY =
          maxTranslateY +
            1 -
            Math.pow(maxTranslateY - currentOffsetY - distanceY, 0.8) || 0;
      }
    }
    return { top: newOffsetY, left: newOffsetX };
  };
  Guestures.prototype.limitPosition = function (
    newOffsetX,
    newOffsetY,
    newWidth,
    newHeight
  ) {
    var self = this;
    var canvasWidth = self.canvasWidth;
    var canvasHeight = self.canvasHeight;
    if (newWidth > canvasWidth) {
      newOffsetX = newOffsetX > 0 ? 0 : newOffsetX;
      newOffsetX =
        newOffsetX < canvasWidth - newWidth
          ? canvasWidth - newWidth
          : newOffsetX;
    } else {
      newOffsetX = Math.max(0, canvasWidth / 2 - newWidth / 2);
    }
    if (newHeight > canvasHeight) {
      newOffsetY = newOffsetY > 0 ? 0 : newOffsetY;
      newOffsetY =
        newOffsetY < canvasHeight - newHeight
          ? canvasHeight - newHeight
          : newOffsetY;
    } else {
      newOffsetY = Math.max(0, canvasHeight / 2 - newHeight / 2);
    }
    return { top: newOffsetY, left: newOffsetX };
  };
  Guestures.prototype.onZoom = function () {
    var self = this;
    var currentWidth = self.contentStartPos.width;
    var currentHeight = self.contentStartPos.height;
    var currentOffsetX = self.contentStartPos.left;
    var currentOffsetY = self.contentStartPos.top;
    var endDistanceBetweenFingers = distance(
      self.newPoints[0],
      self.newPoints[1]
    );
    var pinchRatio =
      endDistanceBetweenFingers / self.startDistanceBetweenFingers;
    var newWidth = Math.floor(currentWidth * pinchRatio);
    var newHeight = Math.floor(currentHeight * pinchRatio);
    var translateFromZoomingX =
      (currentWidth - newWidth) * self.percentageOfImageAtPinchPointX;
    var translateFromZoomingY =
      (currentHeight - newHeight) * self.percentageOfImageAtPinchPointY;
    var centerPointEndX =
      (self.newPoints[0].x + self.newPoints[1].x) / 2 - $(window).scrollLeft();
    var centerPointEndY =
      (self.newPoints[0].y + self.newPoints[1].y) / 2 - $(window).scrollTop();
    var translateFromTranslatingX = centerPointEndX - self.centerPointStartX;
    var translateFromTranslatingY = centerPointEndY - self.centerPointStartY;
    var newOffsetX =
      currentOffsetX + (translateFromZoomingX + translateFromTranslatingX);
    var newOffsetY =
      currentOffsetY + (translateFromZoomingY + translateFromTranslatingY);
    var newPos = {
      top: newOffsetY,
      left: newOffsetX,
      scaleX: self.contentStartPos.scaleX * pinchRatio,
      scaleY: self.contentStartPos.scaleY * pinchRatio,
    };
    self.canTap = false;
    self.newWidth = newWidth;
    self.newHeight = newHeight;
    self.contentLastPos = newPos;
    requestAFrame(function () {
      $.fancybox.setTranslate(self.$content, self.contentLastPos);
    });
  };
  Guestures.prototype.ontouchend = function (e) {
    var self = this;
    var current = self.instance.current;
    var dMs = Math.max(new Date().getTime() - self.startTime, 1);
    var swiping = self.isSwiping;
    var panning = self.isPanning;
    var zooming = self.isZooming;
    self.endPoints = pointers(e);
    self.$container.removeClass("fancybox-controls--isGrabbing");
    self.$wrap.off("touchmove.fb mousemove.fb", $.proxy(this, "ontouchmove"));
    self.$wrap.off(
      "touchend.fb touchcancel.fb mouseup.fb mouseleave.fb",
      $.proxy(this, "ontouchend")
    );
    self.isSwiping = false;
    self.isPanning = false;
    self.isZooming = false;
    if (self.canTap) {
      return self.ontap();
    }
    self.velocityX = (self.distanceX / dMs) * 0.5;
    self.velocityY = (self.distanceY / dMs) * 0.5;
    self.speed = current.opts.speed || 330;
    self.speedX = Math.max(
      self.speed * 0.75,
      Math.min(self.speed * 1.5, (1 / Math.abs(self.velocityX)) * self.speed)
    );
    self.speedY = Math.max(
      self.speed * 0.75,
      Math.min(self.speed * 1.5, (1 / Math.abs(self.velocityY)) * self.speed)
    );
    if (panning) {
      self.endPanning();
    } else if (zooming) {
      self.endZooming();
    } else {
      self.endSwiping(swiping);
    }
    return;
  };
  Guestures.prototype.endSwiping = function (swiping) {
    var self = this;
    if (swiping == "y" && Math.abs(self.distanceY) > 50) {
      $.fancybox.animate(
        self.$slider,
        null,
        {
          top: self.sliderStartPos.top + self.distanceY + self.velocityY * 150,
          left: self.sliderStartPos.left,
          opacity: 0,
        },
        self.speedY
      );
      self.instance.close(true);
    } else if (swiping == "x" && self.distanceX > 50) {
      self.instance.previous(self.speedX);
    } else if (swiping == "x" && self.distanceX < -50) {
      self.instance.next(self.speedX);
    } else {
      self.instance.update(false, true, 150);
    }
  };
  Guestures.prototype.endPanning = function () {
    var self = this;
    var newOffsetX, newOffsetY, newPos;
    if (!self.contentLastPos) {
      return;
    }
    newOffsetX = self.contentLastPos.left + self.velocityX * self.speed * 2;
    newOffsetY = self.contentLastPos.top + self.velocityY * self.speed * 2;
    newPos = self.limitPosition(
      newOffsetX,
      newOffsetY,
      self.contentStartPos.width,
      self.contentStartPos.height
    );
    newPos.width = self.contentStartPos.width;
    newPos.height = self.contentStartPos.height;
    $.fancybox.animate(self.$content, null, newPos, self.speed, "easeOutSine");
  };
  Guestures.prototype.endZooming = function () {
    var self = this;
    var current = self.instance.current;
    var newOffsetX, newOffsetY, newPos, reset;
    var newWidth = self.newWidth;
    var newHeight = self.newHeight;
    if (!self.contentLastPos) {
      return;
    }
    newOffsetX = self.contentLastPos.left;
    newOffsetY = self.contentLastPos.top;
    reset = {
      top: newOffsetY,
      left: newOffsetX,
      width: newWidth,
      height: newHeight,
      scaleX: 1,
      scaleY: 1,
    };
    $.fancybox.setTranslate(self.$content, reset);
    if (newWidth < self.canvasWidth && newHeight < self.canvasHeight) {
      self.instance.scaleToFit(150);
    } else if (newWidth > current.width || newHeight > current.height) {
      self.instance.scaleToActual(
        self.centerPointStartX,
        self.centerPointStartY,
        150
      );
    } else {
      newPos = self.limitPosition(newOffsetX, newOffsetY, newWidth, newHeight);
      $.fancybox.animate(
        self.$content,
        null,
        newPos,
        self.speed,
        "easeOutSine"
      );
    }
  };
  Guestures.prototype.ontap = function () {
    var self = this;
    var instance = self.instance;
    var current = instance.current;
    var x = self.endPoints[0].x;
    var y = self.endPoints[0].y;
    x = x - self.$wrap.offset().left;
    y = y - self.$wrap.offset().top;
    if (instance.SlideShow && instance.SlideShow.isActive) {
      instance.SlideShow.stop();
    }
    if (!$.fancybox.isTouch) {
      if (
        current.opts.closeClickOutside &&
        self.$target.is(".fancybox-slide")
      ) {
        instance.close(self.startEvent);
        return;
      }
      if (current.type == "image" && current.isMoved) {
        if (instance.canPan()) {
          instance.scaleToFit();
        } else if (instance.isScaledDown()) {
          instance.scaleToActual(x, y);
        } else if (instance.group.length < 2) {
          instance.close(self.startEvent);
        }
      }
      return;
    }
    if (self.tapped) {
      clearTimeout(self.tapped);
      self.tapped = null;
      if (
        Math.abs(x - self.x) > 50 ||
        Math.abs(y - self.y) > 50 ||
        !current.isMoved
      ) {
        return this;
      }
      if (current.type == "image" && (current.isLoaded || current.$ghost)) {
        if (instance.canPan()) {
          instance.scaleToFit();
        } else if (instance.isScaledDown()) {
          instance.scaleToActual(x, y);
        }
      }
    } else {
      self.x = x;
      self.y = y;
      self.tapped = setTimeout(function () {
        self.tapped = null;
        instance.toggleControls(true);
      }, 300);
    }
    return this;
  };
  $(document).on("onActivate.fb", function (e, instance) {
    if (instance && !instance.Guestures) {
      instance.Guestures = new Guestures(instance);
    }
  });
  $(document).on("beforeClose.fb", function (e, instance) {
    if (instance && instance.Guestures) {
      instance.Guestures.destroy();
    }
  });
})(window, document, window.jQuery);
(function (document, $) {
  "use strict";
  var SlideShow = function (instance) {
    this.instance = instance;
    this.init();
  };
  $.extend(SlideShow.prototype, {
    timer: null,
    isActive: false,
    $button: null,
    speed: 3000,
    init: function () {
      var self = this;
      self.$button = $(
        '<button data-fancybox-play class="fancybox-button fancybox-button--play" title="Slideshow (P)"></button>'
      ).appendTo(self.instance.$refs.buttons);
      self.instance.$refs.container.on(
        "click",
        "[data-fancybox-play]",
        function () {
          self.toggle();
        }
      );
    },
    set: function () {
      var self = this;
      if (
        self.instance &&
        self.instance.current &&
        (self.instance.current.opts.loop ||
          self.instance.currIndex < self.instance.group.length - 1)
      ) {
        self.timer = setTimeout(function () {
          self.instance.next();
        }, self.instance.current.opts.slideShow.speed || self.speed);
      } else {
        self.stop();
      }
    },
    clear: function () {
      var self = this;
      clearTimeout(self.timer);
      self.timer = null;
    },
    start: function () {
      var self = this;
      self.stop();
      if (
        self.instance &&
        self.instance.current &&
        (self.instance.current.opts.loop ||
          self.instance.currIndex < self.instance.group.length - 1)
      ) {
        self.instance.$refs.container.on({
          "beforeLoad.fb.player": $.proxy(self, "clear"),
          "onComplete.fb.player": $.proxy(self, "set"),
        });
        self.isActive = true;
        if (self.instance.current.isComplete) {
          self.set();
        }
        self.instance.$refs.container.trigger("onPlayStart");
        self.$button.addClass("fancybox-button--pause");
      }
    },
    stop: function () {
      var self = this;
      self.clear();
      self.instance.$refs.container.trigger("onPlayEnd").off(".player");
      self.$button.removeClass("fancybox-button--pause");
      self.isActive = false;
    },
    toggle: function () {
      var self = this;
      if (self.isActive) {
        self.stop();
      } else {
        self.start();
      }
    },
  });
  $(document).on("onInit.fb", function (e, instance) {
    if (
      instance &&
      instance.group.length > 1 &&
      !!instance.opts.slideShow &&
      !instance.SlideShow
    ) {
      instance.SlideShow = new SlideShow(instance);
    }
  });
  $(document).on("beforeClose.fb onDeactivate.fb", function (e, instance) {
    if (instance && instance.SlideShow) {
      instance.SlideShow.stop();
    }
  });
})(document, window.jQuery);
(function (document, $) {
  "use strict";
  var fn = (function () {
    var fnMap = [
      [
        "requestFullscreen",
        "exitFullscreen",
        "fullscreenElement",
        "fullscreenEnabled",
        "fullscreenchange",
        "fullscreenerror",
      ],
      [
        "webkitRequestFullscreen",
        "webkitExitFullscreen",
        "webkitFullscreenElement",
        "webkitFullscreenEnabled",
        "webkitfullscreenchange",
        "webkitfullscreenerror",
      ],
      [
        "webkitRequestFullScreen",
        "webkitCancelFullScreen",
        "webkitCurrentFullScreenElement",
        "webkitCancelFullScreen",
        "webkitfullscreenchange",
        "webkitfullscreenerror",
      ],
      [
        "mozRequestFullScreen",
        "mozCancelFullScreen",
        "mozFullScreenElement",
        "mozFullScreenEnabled",
        "mozfullscreenchange",
        "mozfullscreenerror",
      ],
      [
        "msRequestFullscreen",
        "msExitFullscreen",
        "msFullscreenElement",
        "msFullscreenEnabled",
        "MSFullscreenChange",
        "MSFullscreenError",
      ],
    ];
    var val;
    var ret = {};
    var i, j;
    for (i = 0; i < fnMap.length; i++) {
      val = fnMap[i];
      if (val && val[1] in document) {
        for (j = 0; j < val.length; j++) {
          ret[fnMap[0][j]] = val[j];
        }
        return ret;
      }
    }
    return false;
  })();
  if (!fn) {
    return;
  }
  var FullScreen = {
    request: function (elem) {
      elem = elem || document.documentElement;
      elem[fn.requestFullscreen](elem.ALLOW_KEYBOARD_INPUT);
    },
    exit: function () {
      document[fn.exitFullscreen]();
    },
    toggle: function (elem) {
      if (this.isFullscreen()) {
        this.exit();
      } else {
        this.request(elem);
      }
    },
    isFullscreen: function () {
      return Boolean(document[fn.fullscreenElement]);
    },
    enabled: function () {
      return Boolean(document[fn.fullscreenEnabled]);
    },
  };
  $(document).on({
    "onInit.fb": function (e, instance) {
      var $container;
      if (instance && !!instance.opts.fullScreen && !instance.FullScreen) {
        $container = instance.$refs.container;
        instance.$refs.button_fs = $(
          '<button data-fancybox-fullscreen class="fancybox-button fancybox-button--fullscreen" title="Full screen (F)"></button>'
        ).appendTo(instance.$refs.buttons);
        $container.on(
          "click.fb-fullscreen",
          "[data-fancybox-fullscreen]",
          function (e) {
            e.stopPropagation();
            e.preventDefault();
            FullScreen.toggle($container[0]);
          }
        );
        if (instance.opts.fullScreen.requestOnStart === true) {
          FullScreen.request($container[0]);
        }
      }
    },
    "beforeMove.fb": function (e, instance) {
      if (instance && instance.$refs.button_fs) {
        instance.$refs.button_fs.toggle(!!instance.current.opts.fullScreen);
      }
    },
    "beforeClose.fb": function () {
      FullScreen.exit();
    },
  });
  $(document).on(fn.fullscreenchange, function () {
    var instance = $.fancybox.getInstance();
    var $what = instance ? instance.current.$placeholder : null;
    if ($what) {
      $what.css("transition", "none");
      instance.isAnimating = false;
      instance.update(true, true, 0);
    }
  });
})(document, window.jQuery);
(function (document, $) {
  "use strict";
  var FancyThumbs = function (instance) {
    this.instance = instance;
    this.init();
  };
  $.extend(FancyThumbs.prototype, {
    $button: null,
    $grid: null,
    $list: null,
    isVisible: false,
    init: function () {
      var self = this;
      self.$button = $(
        '<button data-fancybox-thumbs class="fancybox-button fancybox-button--thumbs" title="Thumbnails (G)"></button>'
      )
        .appendTo(this.instance.$refs.buttons)
        .on("touchend click", function (e) {
          e.stopPropagation();
          e.preventDefault();
          self.toggle();
        });
    },
    create: function () {
      var instance = this.instance,
        list,
        src;
      this.$grid = $('<div class="fancybox-thumbs"></div>').appendTo(
        instance.$refs.container
      );
      list = "<ul>";
      $.each(instance.group, function (i, item) {
        src =
          item.opts.thumb ||
          (item.opts.$thumb ? item.opts.$thumb.attr("src") : null);
        if (!src && item.type === "image") {
          src = item.src;
        }
        if (src && src.length) {
          list +=
            '<li data-index="' +
            i +
            '"  tabindex="0" class="fancybox-thumbs-loading"><img data-src="' +
            src +
            '" /></li>';
        }
      });
      list += "</ul>";
      this.$list = $(list)
        .appendTo(this.$grid)
        .on("click touchstart", "li", function () {
          instance.jumpTo($(this).data("index"));
        });
      this.$list
        .find("img")
        .hide()
        .one("load", function () {
          var $parent = $(this).parent().removeClass("fancybox-thumbs-loading"),
            thumbWidth = $parent.outerWidth(),
            thumbHeight = $parent.outerHeight(),
            width,
            height,
            widthRatio,
            heightRatio;
          width = this.naturalWidth || this.width;
          height = this.naturalHeight || this.height;
          widthRatio = width / thumbWidth;
          heightRatio = height / thumbHeight;
          if (widthRatio >= 1 && heightRatio >= 1) {
            if (widthRatio > heightRatio) {
              width = width / heightRatio;
              height = thumbHeight;
            } else {
              width = thumbWidth;
              height = height / widthRatio;
            }
          }
          $(this)
            .css({
              width: Math.floor(width),
              height: Math.floor(height),
              "margin-top": Math.min(
                0,
                Math.floor(thumbHeight * 0.3 - height * 0.3)
              ),
              "margin-left": Math.min(
                0,
                Math.floor(thumbWidth * 0.5 - width * 0.5)
              ),
            })
            .show();
        })
        .each(function () {
          this.src = $(this).data("src");
        });
    },
    focus: function () {
      if (this.instance.current) {
        this.$list
          .children()
          .removeClass("fancybox-thumbs-active")
          .filter('[data-index="' + this.instance.current.index + '"]')
          .addClass("fancybox-thumbs-active")
          .focus();
      }
    },
    close: function () {
      this.$grid.hide();
    },
    update: function () {
      this.instance.$refs.container.toggleClass(
        "fancybox-container--thumbs",
        this.isVisible
      );
      if (this.isVisible) {
        if (!this.$grid) {
          this.create();
        }
        this.$grid.show();
        this.focus();
      } else if (this.$grid) {
        this.$grid.hide();
      }
      this.instance.update();
    },
    hide: function () {
      this.isVisible = false;
      this.update();
    },
    show: function () {
      this.isVisible = true;
      this.update();
    },
    toggle: function () {
      if (this.isVisible) {
        this.hide();
      } else {
        this.show();
      }
    },
  });
  $(document).on("onInit.fb", function (e, instance) {
    var first = instance.group[0],
      second = instance.group[1];
    if (
      !!instance.opts.thumbs &&
      !instance.Thumbs &&
      instance.group.length > 1 &&
      (first.type == "image" || first.opts.thumb || first.opts.$thumb) &&
      (second.type == "image" || second.opts.thumb || second.opts.$thumb)
    ) {
      instance.Thumbs = new FancyThumbs(instance);
    }
  });
  $(document).on("beforeMove.fb", function (e, instance, item) {
    var self = instance && instance.Thumbs;
    if (!self) {
      return;
    }
    if (item.modal) {
      self.$button.hide();
      self.hide();
    } else {
      if (instance.opts.thumbs.showOnStart === true && instance.firstRun) {
        self.show();
      }
      self.$button.show();
      if (self.isVisible) {
        self.focus();
      }
    }
  });
  $(document).on("beforeClose.fb", function (e, instance) {
    if (instance && instance.Thumbs) {
      if (
        instance.Thumbs.isVisible &&
        instance.opts.thumbs.hideOnClosing !== false
      ) {
        instance.Thumbs.close();
      }
      instance.Thumbs = null;
    }
  });
})(document, window.jQuery);
(function (document, window, $) {
  "use strict";
  if (!$.escapeSelector) {
    $.escapeSelector = function (sel) {
      var rcssescape = /([\0-\x1f\x7f]|^-?\d)|^-$|[^\x80-\uFFFF\w-]/g;
      var fcssescape = function (ch, asCodePoint) {
        if (asCodePoint) {
          if (ch === "\0") {
            return "\uFFFD";
          }
          return (
            ch.slice(0, -1) +
            "\\" +
            ch.charCodeAt(ch.length - 1).toString(16) +
            " "
          );
        }
        return "\\" + ch;
      };
      return (sel + "").replace(rcssescape, fcssescape);
    };
  }
  var currentHash = null;
  function parseUrl() {
    var hash = window.location.hash.substr(1);
    var rez = hash.split("-");
    var index =
      rez.length > 1 && /^\+?\d+$/.test(rez[rez.length - 1])
        ? parseInt(rez.pop(-1), 10) || 1
        : 1;
    var gallery = rez.join("-");
    if (index < 1) {
      index = 1;
    }
    return { hash: hash, index: index, gallery: gallery };
  }
  function triggerFromUrl(url) {
    var $el;
    if (url.gallery !== "") {
      $el = $("[data-fancybox='" + $.escapeSelector(url.gallery) + "']").eq(
        url.index - 1
      );
      if ($el.length) {
        $el.trigger("click");
      } else {
        $("#" + $.escapeSelector(url.gallery) + "").trigger("click");
      }
    }
  }
  function getGallery(instance) {
    var opts;
    if (!instance) {
      return false;
    }
    opts = instance.current ? instance.current.opts : instance.opts;
    return opts.$orig ? opts.$orig.data("fancybox") : opts.hash || "";
  }
  $(function () {
    setTimeout(function () {
      if ($.fancybox.defaults.hash === false) {
        return;
      }
      $(window).on("hashchange.fb", function () {
        var url = parseUrl();
        if ($.fancybox.getInstance()) {
          if (currentHash && currentHash !== url.gallery + "-" + url.index) {
            currentHash = null;
            $.fancybox.close();
          }
        } else if (url.gallery !== "") {
          triggerFromUrl(url);
        }
      });
      $(document).on({
        "onInit.fb": function (e, instance) {
          var url = parseUrl();
          var gallery = getGallery(instance);
          if (gallery && url.gallery && gallery == url.gallery) {
            instance.currIndex = url.index - 1;
          }
        },
        "beforeMove.fb": function (e, instance, current) {
          var gallery = getGallery(instance);
          if (gallery && gallery !== "") {
            if (window.location.hash.indexOf(gallery) < 0) {
              instance.opts.origHash = window.location.hash;
            }
            currentHash =
              gallery +
              (instance.group.length > 1 ? "-" + (current.index + 1) : "");
            if ("pushState" in history) {
              history.pushState(
                "",
                document.title,
                window.location.pathname +
                  window.location.search +
                  "#" +
                  currentHash
              );
            } else {
              window.location.hash = currentHash;
            }
          }
        },
        "beforeClose.fb": function (e, instance, current) {
          var gallery = getGallery(instance);
          var origHash =
            instance && instance.opts.origHash ? instance.opts.origHash : "";
          if (gallery && gallery !== "") {
            if ("pushState" in history) {
              history.pushState(
                "",
                document.title,
                window.location.pathname + window.location.search + origHash
              );
            } else {
              window.location.hash = origHash;
            }
          }
          currentHash = null;
        },
      });
      triggerFromUrl(parseUrl());
    }, 50);
  });
})(document, window, window.jQuery);

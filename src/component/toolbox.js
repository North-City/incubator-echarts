/**
 * echarts组件：工具箱
 *
 * @desc echarts基于Canvas，纯Javascript图表库，提供直观，生动，可交互，可个性化定制的数据统计图表。
 * @author Kener (@Kener-林峰, linzhifeng@baidu.com)
 *
 */
define(function (require) {
    var Base = require('./base');
    
    // 图形依赖
    var LineShape = require('zrender/shape/Line');
    var ImageShape = require('zrender/shape/Image');
    var RectangleShape = require('zrender/shape/Rectangle');
    var IconShape = require('../util/shape/Icon');
    
    var ecConfig = require('../config');
    var zrUtil = require('zrender/tool/util');
    var zrConfig = require('zrender/config');
    var zrEvent = require('zrender/tool/event');
    
    var _MAGICTYPE_STACK = 'stack';
    var _MAGICTYPE_TILED = 'tiled';
        
    /**
     * 构造函数
     * @param {Object} messageCenter echart消息中心
     * @param {ZRender} zr zrender实例
     * @param {HtmlElement} dom 目标对象
     * @param {ECharts} myChart 当前图表实例
     */
    function Toolbox(ecTheme, messageCenter, zr, dom, myChart) {
        Base.call(this, ecTheme, zr, {});

        this.messageCenter = messageCenter;
        this.dom = dom;
        this.myChart = myChart;
        
        this._magicType = {};
        //this._magicMap;
        this._isSilence = false;
        
        this._iconList;
        this._iconShapeMap = {};
        //this._itemGroupLocation;
        this._featureTitle = {};             // 文字
        this._featureIcon = {};              // 图标
        this._featureColor = {};             // 颜色
        this._enableColor = 'red';
        this._disableColor = '#ccc';
        // this._markStart;
        // this._marking;
        // this._markShape;
        // this._zoomStart;
        // this._zooming;
        // this._zoomShape;
        // this._zoomQueue;
        // this._dataView;
        var self = this;
        self._onmousemove = function (param) {
            if (self._marking) {
                self._markShape.style.xEnd = zrEvent.getX(param.event);
                self._markShape.style.yEnd = zrEvent.getY(param.event);
                self.zr.addHoverShape(self._markShape);
            }
            if (self._zooming) {
                self._zoomShape.style.width = 
                    zrEvent.getX(param.event) - self._zoomShape.style.x;
                self._zoomShape.style.height = 
                    zrEvent.getY(param.event) - self._zoomShape.style.y;
                self.zr.addHoverShape(self._zoomShape);
                self.dom.style.cursor = 'crosshair';
            }
            if (self._zoomStart
                && (self.dom.style.cursor != 'pointer' && self.dom.style.cursor != 'move')
            ) {
                self.dom.style.cursor = 'crosshair';
            }
        };

        self._onmousedown = function (param) {
            if (param.target) {
                return;
            }
            self._zooming = true;
            var x = zrEvent.getX(param.event);
            var y = zrEvent.getY(param.event);
            var zoomOption = self.option.dataZoom || {};
            self._zoomShape = new RectangleShape({
                zlevel : self._zlevelBase,
                style : {
                    x : x,
                    y : y,
                    width : 1,
                    height : 1,
                    brushType: 'both'
                },
                highlightStyle : {
                    lineWidth : 2,
                    color: zoomOption.fillerColor 
                           || ecConfig.dataZoom.fillerColor,
                    strokeColor : zoomOption.handleColor 
                                  || ecConfig.dataZoom.handleColor,
                    brushType: 'both'
                }
            });
            self.zr.addHoverShape(self._zoomShape);
            return true; // 阻塞全局事件
        };
        
        self._onmouseup = function (/*param*/) {
            if (!self._zoomShape 
                || Math.abs(self._zoomShape.style.width) < 10 
                || Math.abs(self._zoomShape.style.height) < 10
            ) {
                self._zooming = false;
                return true;
            }
            if (self._zooming && self.component.dataZoom) {
                self._zooming = false;
                
                var zoom = self.component.dataZoom.rectZoom(self._zoomShape.style);
                if (zoom) {
                    self._zoomQueue.push({
                        start : zoom.start,
                        end : zoom.end,
                        start2 : zoom.start2,
                        end2 : zoom.end2
                    });
                    self._iconEnable(self._iconShapeMap['dataZoomReset']);
                    self.zr.refresh();
                }
            }
            return true; // 阻塞全局事件
        };
        
        self._onclick = function (param) {
            if (param.target) {
                return;
            }
            if (self._marking) {
                self._marking = false;
                self.shapeList.push(self._markShape);
                self._iconEnable(self._iconShapeMap['markUndo']);
                self._iconEnable(self._iconShapeMap['markClear']);
                self.zr.addShape(self._markShape);
                self.zr.refresh();
            } 
            else if (self._markStart) {
                self._marking = true;
                var x = zrEvent.getX(param.event);
                var y = zrEvent.getY(param.event);
                self._markShape = new LineShape({
                    zlevel : self._zlevelBase,
                    style : {
                        xStart : x,
                        yStart : y,
                        xEnd : x,
                        yEnd : y,
                        lineWidth : self.query(
                                        self.option,
                                        'toolbox.feature.mark.lineStyle.width'
                                    ),
                        strokeColor : self.query(
                                          self.option,
                                          'toolbox.feature.mark.lineStyle.color'
                                      ),
                        lineType : self.query(
                                       self.option,
                                       'toolbox.feature.mark.lineStyle.type'
                                   )
                    }
                });
                self.zr.addHoverShape(self._markShape);
            }
        };
    }

    Toolbox.prototype = {
        type : ecConfig.COMPONENT_TYPE_TOOLBOX,
        _buildShape : function () {
            this._iconList = [];
            var feature = this.option.toolbox.feature;
            var iconName = [];
            for (var key in feature){
                if (feature[key].show) {
                    switch (key) {
                        case 'mark' :
                            iconName.push({key : key, name : 'mark'});
                            iconName.push({key : key, name : 'markUndo'});
                            iconName.push({key : key, name : 'markClear'});
                            break;
                        case 'magicType' :
                            for (var i = 0, l = feature[key].type.length; i < l; i++) {
                                feature[key].title[feature[key].type[i] + 'Chart']
                                    = feature[key].title[feature[key].type[i]];
                                iconName.push({key : key, name : feature[key].type[i] + 'Chart'});
                            }
                            break;
                        case 'dataZoom' :
                            iconName.push({key : key, name : 'dataZoom'});
                            iconName.push({key : key, name : 'dataZoomReset'});
                            break;
                        case 'saveAsImage' :
                            if (this.canvasSupported) {
                                iconName.push({key : key, name : 'saveAsImage'});
                            }
                            break;
                        default :
                            iconName.push({key : key, name : key});
                            break;
                    }
                }
            }
            if (iconName.length > 0) {
                var name;
                var key;
                for (var i = 0, l = iconName.length; i < l; i++) {
                    name = iconName[i].name;
                    key = iconName[i].key;
                    this._iconList.push(name);
                    this._featureTitle[name] = feature[key].title[name] || feature[key].title;
                    if (feature[key].icon) {
                        this._featureIcon[name] = feature[key].icon[name] || feature[key].icon;
                    }
                    if (feature[key].color) {
                        this._featureColor[name] = feature[key].color[name] || feature[key].color;
                    }
                }
                this._itemGroupLocation = this._getItemGroupLocation();

                this._buildBackground();
                this._buildItem();

                for (var i = 0, l = this.shapeList.length; i < l; i++) {
                    this.zr.addShape(this.shapeList[i]);
                }
                if (this._iconShapeMap['mark']) {
                    this._iconDisable(this._iconShapeMap['markUndo']);
                    this._iconDisable(this._iconShapeMap['markClear']);
                }
                if (this._iconShapeMap['dataZoomReset'] && this._zoomQueue.length === 0) {
                    this._iconDisable(this._iconShapeMap['dataZoomReset']);
                }
            }
        },

        /**
         * 构建所有图例元素
         */
        _buildItem : function () {
            var toolboxOption = this.option.toolbox;
            var iconLength = this._iconList.length;
            var lastX = this._itemGroupLocation.x;
            var lastY = this._itemGroupLocation.y;
            var itemSize = toolboxOption.itemSize;
            var itemGap = toolboxOption.itemGap;
            var itemShape;

            var color = toolboxOption.color instanceof Array
                        ? toolboxOption.color : [toolboxOption.color];
            
            var textFont = this.getFont(toolboxOption.textStyle);
            var textPosition;
            var textAlign;
            var textBaseline;
            if (toolboxOption.orient == 'horizontal') {
                textPosition = this._itemGroupLocation.y / this.zr.getHeight() < 0.5
                               ? 'bottom' : 'top';
                textAlign = this._itemGroupLocation.x / this.zr.getWidth() < 0.5
                            ? 'left' : 'right';
                textBaseline = this._itemGroupLocation.y / this.zr.getHeight() < 0.5
                               ? 'top' : 'bottom';
            }
            else {
                textPosition = this._itemGroupLocation.x / this.zr.getWidth() < 0.5
                               ? 'right' : 'left';
                /*
                textAlign = this._itemGroupLocation.x / this.zr.getWidth() < 0.5
                               ? 'right' : 'left';
                textBaseline = 'top';
                */
            }
            
           this._iconShapeMap = {};
           var self = this;

            for (var i = 0; i < iconLength; i++) {
                // 图形
                itemShape = {
                    type : 'icon',
                    zlevel : this._zlevelBase,
                    style : {
                        x : lastX,
                        y : lastY,
                        width : itemSize,
                        height : itemSize,
                        iconType : this._iconList[i],
                        lineWidth : 1,
                        strokeColor : this._featureColor[this._iconList[i]] || color[i % color.length],
                        brushType: 'stroke'
                    },
                    highlightStyle : {
                        lineWidth : 2,
                        text : toolboxOption.showTitle 
                               ? this._featureTitle[this._iconList[i]]
                               : undefined,
                        textFont : textFont,
                        textPosition : textPosition,
                        strokeColor : this._featureColor[this._iconList[i]] || color[i % color.length]
                    },
                    hoverable : true,
                    clickable : true
                };
                
                if (this._featureIcon[this._iconList[i]]) {
                    itemShape.style.image = this._featureIcon[this._iconList[i]].replace(
                        new RegExp('^image:\\/\\/'), ''
                    );
                    itemShape.style.opacity = 0.8;
                    itemShape.highlightStyle.opacity = 1;
                    itemShape.type = 'image';
                }
                
                if (toolboxOption.orient == 'horizontal') {
                    // 修正左对齐第一个或右对齐最后一个
                    if (i === 0 && textAlign == 'left') {
                        itemShape.highlightStyle.textPosition = 'specific';
                        itemShape.highlightStyle.textAlign = textAlign;
                        itemShape.highlightStyle.textBaseline = textBaseline;
                        itemShape.highlightStyle.textX = lastX;
                        itemShape.highlightStyle.textY = textBaseline == 'top' 
                                                     ? lastY + itemSize + 10
                                                     : lastY - 10;
                    }
                    if (i == iconLength - 1 && textAlign == 'right') {
                        itemShape.highlightStyle.textPosition = 'specific';
                        itemShape.highlightStyle.textAlign = textAlign;
                        itemShape.highlightStyle.textBaseline = textBaseline;
                        itemShape.highlightStyle.textX = lastX + itemSize;
                        itemShape.highlightStyle.textY = textBaseline == 'top' 
                                                     ? lastY + itemSize + 10
                                                     : lastY - 10;
                    }
                }
                
                
                switch(this._iconList[i]) {
                    case 'mark':
                        itemShape.onclick = function (param) {
                            self._onMark(param);
                        };
                        break;
                    case 'markUndo':
                        itemShape.onclick = function (param) {
                            self._onMarkUndo(param);
                        };
                        break;
                    case 'markClear':
                        itemShape.onclick = function (param) {
                            self._onMarkClear(param);
                        };
                        break;
                    case 'dataZoom':
                        itemShape.onclick = function (param) {
                            self._onDataZoom(param);
                        };
                        break;
                    case 'dataZoomReset':
                        itemShape.onclick = function (param) {
                            self._onDataZoomReset(param);
                        };
                        break;
                    case 'dataView' :
                        if (!this._dataView) {
                            var componentLibrary = require('../component');
                            var DataView = componentLibrary.get('dataView');
                            this._dataView = new DataView(
                                this.ecTheme, this.messageCenter, this.zr, this.option, this.dom
                            );
                        }
                        itemShape.onclick = function (param) {
                            self._onDataView(param);
                        };
                        break;
                    case 'restore':
                        itemShape.onclick = function (param) {
                            self._onRestore(param);
                        };
                        break;
                    case 'saveAsImage':
                        itemShape.onclick = function (param) {
                            self._onSaveAsImage(param);
                        };
                        break;
                    default:
                        if (this._iconList[i].match('Chart')) {
                            itemShape._name = this._iconList[i].replace('Chart', '');
                            if (this._magicType[itemShape._name]) {
                                itemShape.style.strokeColor = this._enableColor;
                            }
                            itemShape.onclick = function (param) {
                                self._onMagicType(param);
                            };
                        }
                        else {
                            itemShape.onclick = function (param) {
                                self._onCustomHandler(param);
                            };
                        }
                        break;
                }

                if (itemShape.type == 'icon') {
                    itemShape = new IconShape(itemShape);
                }
                else if (itemShape.type == 'image') {
                    itemShape = new ImageShape(itemShape);
                }
                this.shapeList.push(itemShape);
                this._iconShapeMap[this._iconList[i]] = itemShape;

                if (toolboxOption.orient == 'horizontal') {
                    lastX += itemSize + itemGap;
                }
                else {
                    lastY += itemSize + itemGap;
                }
            }
        },

        _buildBackground : function () {
            var toolboxOption = this.option.toolbox;
            var pTop = toolboxOption.padding[0];
            var pRight = toolboxOption.padding[1];
            var pBottom = toolboxOption.padding[2];
            var pLeft = toolboxOption.padding[3];

            this.shapeList.push(new RectangleShape({
                zlevel : this._zlevelBase,
                hoverable :false,
                style : {
                    x : this._itemGroupLocation.x - pLeft,
                    y : this._itemGroupLocation.y - pTop,
                    width : this._itemGroupLocation.width + pLeft + pRight,
                    height : this._itemGroupLocation.height + pTop + pBottom,
                    brushType : toolboxOption.borderWidth === 0
                                ? 'fill' : 'both',
                    color : toolboxOption.backgroundColor,
                    strokeColor : toolboxOption.borderColor,
                    lineWidth : toolboxOption.borderWidth
                }
            }));
        },

        /**
         * 根据选项计算图例实体的位置坐标
         */
        _getItemGroupLocation : function () {
            var toolboxOption = this.option.toolbox;
            var iconLength = this._iconList.length;
            var itemGap = toolboxOption.itemGap;
            var itemSize = toolboxOption.itemSize;
            var totalWidth = 0;
            var totalHeight = 0;

            if (toolboxOption.orient == 'horizontal') {
                // 水平布局，计算总宽度，别忘减去最后一个的itemGap
                totalWidth = (itemSize + itemGap) * iconLength - itemGap;
                totalHeight = itemSize;
            }
            else {
                // 垂直布局，计算总高度
                totalHeight = (itemSize + itemGap) * iconLength - itemGap;
                totalWidth = itemSize;
            }

            var x;
            var zrWidth = this.zr.getWidth();
            switch (toolboxOption.x) {
                case 'center' :
                    x = Math.floor((zrWidth - totalWidth) / 2);
                    break;
                case 'left' :
                    x = toolboxOption.padding[3] + toolboxOption.borderWidth;
                    break;
                case 'right' :
                    x = zrWidth
                        - totalWidth
                        - toolboxOption.padding[1]
                        - toolboxOption.borderWidth;
                    break;
                default :
                    x = toolboxOption.x - 0;
                    x = isNaN(x) ? 0 : x;
                    break;
            }

            var y;
            var zrHeight = this.zr.getHeight();
            switch (toolboxOption.y) {
                case 'top' :
                    y = toolboxOption.padding[0] + toolboxOption.borderWidth;
                    break;
                case 'bottom' :
                    y = zrHeight
                        - totalHeight
                        - toolboxOption.padding[2]
                        - toolboxOption.borderWidth;
                    break;
                case 'center' :
                    y = Math.floor((zrHeight - totalHeight) / 2);
                    break;
                default :
                    y = toolboxOption.y - 0;
                    y = isNaN(y) ? 0 : y;
                    break;
            }

            return {
                x : x,
                y : y,
                width : totalWidth,
                height : totalHeight
            };
        },

        _onMark : function (param) {
            var target = param.target;
            if (this._marking || this._markStart) {
                // 取消
                this._resetMark();
                this.zr.refresh();
            }
            else {
                // 启用Mark
                this._resetZoom();   // mark与dataZoom互斥
                
                this.zr.modShape(target.id, {style: {strokeColor: this._enableColor}});
                this.zr.refresh();
                this._markStart = true;
                var self = this;
                setTimeout(function (){
                    self.zr
                    && self.zr.on(zrConfig.EVENT.CLICK, self._onclick)
                    && self.zr.on(zrConfig.EVENT.MOUSEMOVE, self._onmousemove);
                }, 10);
            }
            return true; // 阻塞全局事件
        },
        
        _onDataZoom : function (param) {
            var target = param.target;
            if (this._zooming || this._zoomStart) {
                // 取消
                this._resetZoom();
                this.zr.refresh();
                this.dom.style.cursor = 'default';
            }
            else {
                // 启用Zoom
                this._resetMark();   // mark与dataZoom互斥
                
                this.zr.modShape(target.id, {style: {strokeColor: this._enableColor}});
                this.zr.refresh();
                this._zoomStart = true;
                var self = this;
                setTimeout(function (){
                    self.zr
                    && self.zr.on(zrConfig.EVENT.MOUSEDOWN, self._onmousedown)
                    && self.zr.on(zrConfig.EVENT.MOUSEUP, self._onmouseup)
                    && self.zr.on(zrConfig.EVENT.MOUSEMOVE, self._onmousemove);
                }, 10);
                
                this.dom.style.cursor = 'crosshair';
            }
            return true; // 阻塞全局事件
        },

        _onMarkUndo : function () {
            if (this._marking) {
                this._marking = false;
            } else {
                var len = this.shapeList.length - 1;    // 有一个是背景shape
                if (this._iconList.length == len - 1) {
                    this._iconDisable(this._iconShapeMap['markUndo']);
                    this._iconDisable(this._iconShapeMap['markClear']);
                }
                if (this._iconList.length < len) {
                    var target = this.shapeList[this.shapeList.length - 1];
                    this.zr.delShape(target.id);
                    this.zr.refresh();
                    this.shapeList.pop();
                }
            }
            return true;
        },

        _onMarkClear : function () {
            if (this._marking) {
                this._marking = false;
            }
            // 有一个是背景shape
            var len = this.shapeList.length - this._iconList.length - 1;
            var hasClear = false;
            while(len--) {
                this.zr.delShape(this.shapeList.pop().id);
                hasClear = true;
            }
            if (hasClear) {
                this._iconDisable(this._iconShapeMap['markUndo']);
                this._iconDisable(this._iconShapeMap['markClear']);
                this.zr.refresh();
            }
            return true;
        },
        
        _onDataZoomReset : function () {
            if (this._zooming) {
                this._zooming = false;
            }
            this._zoomQueue.pop();
            //console.log(this._zoomQueue)
            if (this._zoomQueue.length > 0) {
                this.component.dataZoom.absoluteZoom(
                    this._zoomQueue[this._zoomQueue.length - 1]
                );
            }
            else {
                this.component.dataZoom.rectZoom();
                this._iconDisable(this._iconShapeMap['dataZoomReset']);
                this.zr.refresh();
            }
            
            return true;
        },

        _resetMark : function () {
            this._marking = false;
            if (this._markStart) {
                this._markStart = false;
                if (this._iconShapeMap['mark']) {
                    // 还原图标为未生效状态
                    this.zr.modShape(
                        this._iconShapeMap['mark'].id,
                        {
                            style: {
                                strokeColor: this._iconShapeMap['mark']
                                                 .highlightStyle
                                                 .strokeColor
                            }
                         }
                    );
                }
                
                this.zr.un(zrConfig.EVENT.CLICK, this._onclick);
                this.zr.un(zrConfig.EVENT.MOUSEMOVE, this._onmousemove);
            }
        },
        
        _resetZoom : function () {
            this._zooming = false;
            if (this._zoomStart) {
                this._zoomStart = false;
                if (this._iconShapeMap['dataZoom']) {
                    // 还原图标为未生效状态
                    this.zr.modShape(
                        this._iconShapeMap['dataZoom'].id,
                        {
                            style: {
                                strokeColor: this._iconShapeMap['dataZoom']
                                                 .highlightStyle
                                                 .strokeColor
                            }
                         }
                    );
                }
                
                this.zr.un(zrConfig.EVENT.MOUSEDOWN, this._onmousedown);
                this.zr.un(zrConfig.EVENT.MOUSEUP, this._onmouseup);
                this.zr.un(zrConfig.EVENT.MOUSEMOVE, this._onmousemove);
            }
        },

        _iconDisable : function (target) {
            if (target.type != 'image') {
                this.zr.modShape(target.id, {
                    hoverable : false,
                    clickable : false,
                    style : {
                        strokeColor : this._disableColor
                    }
                });
            }
            else {
                this.zr.modShape(target.id, {
                    hoverable : false,
                    clickable : false,
                    style : {
                        opacity : 0.3
                    }
                });
            }
        },

        _iconEnable : function (target) {
            if (target.type != 'image') {
                this.zr.modShape(target.id, {
                    hoverable : true,
                    clickable : true,
                    style : {
                        strokeColor : target.highlightStyle.strokeColor
                    }
                });
            }
            else {
                this.zr.modShape(target.id, {
                    hoverable : true,
                    clickable : true,
                    style : {
                        opacity : 0.8
                    }
                });
            }
        },

        _onDataView : function () {
            this._dataView.show(this.option);
            return true;
        },

        _onRestore : function (){
            this._resetMark();
            this._resetZoom();
            this.messageCenter.dispatch(ecConfig.EVENT.RESTORE);
            return true;
        },
        
        _onSaveAsImage : function () {
            var saveOption = this.option.toolbox.feature.saveAsImage;
            var imgType = saveOption.type || 'png';
            if (imgType != 'png' && imgType != 'jpeg') {
                imgType = 'png';
            }
            
            var image;
            if (!this.myChart.isConnected()) {
                image = this.zr.toDataURL(
                    'image/' + imgType,
                    this.option.backgroundColor 
                    && this.option.backgroundColor.replace(' ','') == 'rgba(0,0,0,0)'
                        ? '#fff' : this.option.backgroundColor
                );
            }
            else {
                image = this.myChart.getConnectedDataURL(imgType);
            }
             
            var downloadDiv = document.createElement('div');
            downloadDiv.id = '__echarts_download_wrap__';
            downloadDiv.style.cssText = 'position:fixed;'
                + 'z-index:99999;'
                + 'display:block;'
                + 'top:0;left:0;'
                + 'background-color:rgba(33,33,33,0.5);'
                + 'text-align:center;'
                + 'width:100%;'
                + 'height:100%;'
                + 'line-height:' 
                + document.documentElement.clientHeight + 'px;';
                
            var downloadLink = document.createElement('a');
            //downloadLink.onclick = _saveImageForIE;
            downloadLink.href = image;
            downloadLink.setAttribute(
                'download',
                (saveOption.name 
                 ? saveOption.name 
                 : (this.option.title && (this.option.title.text || this.option.title.subtext))
                   ? (this.option.title.text || this.option.title.subtext)
                   : 'ECharts')
                + '.' + imgType 
            );
            downloadLink.innerHTML = '<img style="vertical-align:middle" src="' + image 
                + '" title="'
                + (!!(window.attachEvent 
                     && navigator.userAgent.indexOf('Opera') === -1)
                  ? '右键->图片另存为'
                  : (saveOption.lang ? saveOption.lang[0] : '点击保存'))
                + '"/>';
            
            downloadDiv.appendChild(downloadLink);
            document.body.appendChild(downloadDiv);
            downloadLink = null;
            downloadDiv = null;
            
            setTimeout(function (){
                var _d = document.getElementById('__echarts_download_wrap__');
                if (_d) {
                    _d.onclick = function () {
                        var d = document.getElementById(
                            '__echarts_download_wrap__'
                        );
                        d.onclick = null;
                        d.innerHTML = '';
                        document.body.removeChild(d);
                        d = null;
                    };
                    _d = null;
                }
            }, 500);
            
            /*
            function _saveImageForIE() {
                window.win = window.open(image);
                win.document.execCommand("SaveAs");
                win.close()
            }
            */
            return;
        },

        _onMagicType : function (param) {
            this._resetMark();
            var itemName = param.target._name;
            if (this._magicType[itemName]) {
                // 取消
                this._magicType[itemName] = false;
            }
            else {
                // 启用
                this._magicType[itemName] = true;
                // 折柱互斥
                if (itemName == ecConfig.CHART_TYPE_LINE) {
                    this._magicType[ecConfig.CHART_TYPE_BAR] = false;
                }
                else if (itemName == ecConfig.CHART_TYPE_BAR) {
                    this._magicType[ecConfig.CHART_TYPE_LINE] = false;
                }
                // 堆叠平铺互斥
                if (itemName == _MAGICTYPE_STACK) {
                    this._magicType[_MAGICTYPE_TILED] = false;
                }
                else if (itemName == _MAGICTYPE_TILED) {
                    this._magicType[_MAGICTYPE_STACK] = false;
                }
            }
            this.messageCenter.dispatch(
                ecConfig.EVENT.MAGIC_TYPE_CHANGED,
                param.event,
                {magicType : this._magicType}
            );
            return true;
        },
        
        setMagicType : function (magicType) {
            this._resetMark();
            this._magicType = magicType;
            
            !this._isSilence && this.messageCenter.dispatch(
                ecConfig.EVENT.MAGIC_TYPE_CHANGED,
                null,
                {magicType : this._magicType}
            );
        },
        
        // 用户自定义扩展toolbox方法
        _onCustomHandler : function (param) {
            var target = param.target.style.iconType;
            var featureHandler = this.option.toolbox.feature[target].onclick;
            if (typeof featureHandler === 'function') {
                featureHandler(this.option);
            }
        },

        // 重置备份还原状态等
        reset : function (newOption) {
            if (this.query(newOption, 'toolbox.show')
                && this.query(newOption, 'toolbox.feature.magicType.show')
            ) {
                var magicType = newOption.toolbox.feature.magicType.type;
                var len = magicType.length;
                this._magicMap = {};     // 标识可控类型
                while (len--) {
                    this._magicMap[magicType[len]] = true;
                }

                len = newOption.series.length;
                var oriType;        // 备份还原可控类型
                var axis;
                while (len--) {
                    oriType = newOption.series[len].type;
                    if (this._magicMap[oriType]) {
                        axis = newOption.xAxis instanceof Array
                               ? newOption.xAxis[
                                     newOption.series[len].xAxisIndex || 0
                                 ]
                               : newOption.xAxis;
                        if (axis && (axis.type || 'category') == 'category') {
                            axis.__boundaryGap =
                                typeof axis.boundaryGap != 'undefined'
                                ? axis.boundaryGap : true;
                        }
                        axis = newOption.yAxis instanceof Array
                               ? newOption.yAxis[
                                     newOption.series[len].yAxisIndex || 0
                                 ]
                               : newOption.yAxis;
                        if (axis && axis.type == 'category') {
                            axis.__boundaryGap =
                                typeof axis.boundaryGap != 'undefined'
                                ? axis.boundaryGap : true;
                        }
                        newOption.series[len].__type = oriType;
                        // 避免不同类型图表类型的样式污染
                        newOption.series[len].__itemStyle = 
                            newOption.series[len].itemStyle
                            ? zrUtil.clone(
                                  newOption.series[len].itemStyle
                              )
                            : {};
                    }
                    
                    if (this._magicMap[_MAGICTYPE_STACK] || this._magicMap[_MAGICTYPE_TILED]) {
                        newOption.series[len].__stack = newOption.series[len].stack;
                    }
                }
            }
            this._magicType = {};
            
            // 框选缩放
            var zoomOption = newOption.dataZoom;
            if (zoomOption && zoomOption.show) {
                var start = typeof zoomOption.start != 'undefined'
                            && zoomOption.start >= 0
                            && zoomOption.start <= 100
                            ? zoomOption.start : 0;
                var end = typeof zoomOption.end != 'undefined'
                          && zoomOption.end >= 0
                          && zoomOption.end <= 100
                          ? zoomOption.end : 100;
                if (start > end) {
                    // 大小颠倒自动翻转
                    start = start + end;
                    end = start - end;
                    start = start - end;
                }
                this._zoomQueue = [{
                    start : start,
                    end : end,
                    start2 : 0,
                    end2 : 100
                }];
            }
            else {
                this._zoomQueue = [];
            }
        },
        
        getMagicOption : function (){
            var axis;
            if (this._magicType[ecConfig.CHART_TYPE_LINE] || this._magicType[ecConfig.CHART_TYPE_BAR]) {
                // 图表类型有切换
                var boundaryGap = this._magicType[ecConfig.CHART_TYPE_LINE] ? false : true;
                for (var i = 0, l = this.option.series.length; i < l; i++) {
                    if (this._magicMap[this.option.series[i].type]) {
                        this.option.series[i].type = this._magicType[ecConfig.CHART_TYPE_LINE]
                                                ? ecConfig.CHART_TYPE_LINE
                                                : ecConfig.CHART_TYPE_BAR;
                        // 避免不同类型图表类型的样式污染
                        this.option.series[i].itemStyle = zrUtil.clone(
                            this.option.series[i].__itemStyle
                        );
                        
                        axis = this.option.xAxis instanceof Array
                               ? this.option.xAxis[this.option.series[i].xAxisIndex || 0]
                               : this.option.xAxis;
                        if (axis && (axis.type || 'category') == 'category') {
                            axis.boundaryGap = 
                                boundaryGap ? true : axis.__boundaryGap;
                        }
                        axis = this.option.yAxis instanceof Array
                               ? this.option.yAxis[this.option.series[i].yAxisIndex || 0]
                               : this.option.yAxis;
                        if (axis && axis.type == 'category') {
                            axis.boundaryGap = 
                                boundaryGap ? true : axis.__boundaryGap;
                        }
                    }
                }
            }
            else {
                // 图表类型无切换
                for (var i = 0, l = this.option.series.length; i < l; i++) {
                    if (this._magicMap[this.option.series[i].type]) {
                        this.option.series[i].type = this.option.series[i].__type;
                        // 避免不同类型图表类型的样式污染
                        this.option.series[i].itemStyle = 
                            this.option.series[i].__itemStyle;
                        
                        axis = this.option.xAxis instanceof Array
                               ? this.option.xAxis[this.option.series[i].xAxisIndex || 0]
                               : this.option.xAxis;
                        if (axis && (axis.type || 'category') == 'category') {
                            axis.boundaryGap = axis.__boundaryGap;
                        }
                        axis = this.option.yAxis instanceof Array
                               ? this.option.yAxis[this.option.series[i].yAxisIndex || 0]
                               : this.option.yAxis;
                        if (axis && axis.type == 'category') {
                            axis.boundaryGap = axis.__boundaryGap;
                        }
                    }
                }
            }
            
            if (this._magicType[_MAGICTYPE_STACK] || this._magicType[_MAGICTYPE_TILED]) {
                // 有堆叠平铺切换
                for (var i = 0, l = this.option.series.length; i < l; i++) {
                    if (this._magicType[_MAGICTYPE_STACK]) {
                        // 启用堆叠
                        this.option.series[i].stack = '_ECHARTS_STACK_KENER_2014_';
                    }
                    else if (this._magicType[_MAGICTYPE_TILED]) {
                        // 启用平铺
                        this.option.series[i].stack = null;
                    }
                }
            }
            else {
                // 无堆叠平铺切换
                for (var i = 0, l = this.option.series.length; i < l; i++) {
                    this.option.series[i].stack = this.option.series[i].__stack;
                }
            }

            return this.option;
        },

        silence : function (s) {
            this._isSilence = s;
        },
        
        render : function (newOption, newComponent){
            this._resetMark();
            this._resetZoom();
            newOption.toolbox = this.reformOption(newOption.toolbox);
            // 补全padding属性
            newOption.toolbox.padding = this.reformCssArray(
                newOption.toolbox.padding
            );
            this.option = newOption || this.option;
            this.component = newComponent || this.component;
            
            this.clear();

            if (newOption.toolbox.show) {
                this._buildShape();
            }

            this.hideDataView();
        },

        resize : function () {
            this._resetMark();
            this.clear();
            if (this.option && this.option.toolbox && this.option.toolbox.show) {
               this._buildShape();
            }
            if (this._dataView) {
                this._dataView.resize();
            }
        },

        hideDataView : function () {
            if (this._dataView) {
                this._dataView.hide();
            }
        },

        /**
         * 释放后实例不可用
         */
        dispose : function () {
            if (this._dataView) {
                this._dataView.dispose();
                this._dataView = null;
            }

            this.shapeList = null;
        },
        
        /**
         * 刷新
         */
        refresh : function (newOption) {
            if (newOption) {
                newOption.toolbox = this.reformOption(newOption.toolbox);
                // 补全padding属性
                newOption.toolbox.padding = this.reformCssArray(
                    newOption.toolbox.padding
                );
                this.option = newOption;
            }
        }
    };
    
    zrUtil.inherits(Toolbox, Base);
    
    require('../component').define('toolbox', Toolbox);
    
    return Toolbox;
});

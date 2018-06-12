/**
 * @fileoverview Description of file, its uses and information
 * about its dependencies.
 */

'use strict';

var meta;
var layers;

var switchLayer;

var cloud;

var layers;

var backboneEvents;

var onEachFeature = [];

var pointToLayer = [];

var onLoad = [];

var onSelect = [];

var onMouseOver = [];

var cm = [];

var styles = [];

var store = [];

var automatic = true;

var _self;

/**
 *
 * @type {*|exports|module.exports}
 */
var urlparser = require('./urlparser');

/**
 * @type {string}
 */
var db = urlparser.db;

/**
 *
 * @type {*|exports|module.exports}
 */
let APIBridgeSingletone = require('./api-bridge');

/**
 *
 * @type {APIBridge}
 */
var apiBridgeInstance = false;

/**
 * Stores the last value of application online status
 */
var applicationIsOnline = -1;

var lastStatistics = false;

var theStatisticsPanelWasDrawn = false;

/**
 *
 * @type {{set: module.exports.set, init: module.exports.init}}
 */
module.exports = {
    set: function (o) {
        cloud = o.cloud;
        meta = o.meta;
        layers = o.layers;
        switchLayer = o.switchLayer;
        backboneEvents = o.backboneEvents;
        return this;
    },

    init: function () {
        _self = this;

        apiBridgeInstance = APIBridgeSingletone((statistics, forceLayerUpdate) => {
            _self.statisticsHandler(statistics, forceLayerUpdate);
        });
    },

    /**
     * Displays current state of APIBridge feature management
     *
     * @param {*} statistics
     * @param {*} forceLayerUpdate
     */
    statisticsHandler: (statistics, forceLayerUpdate = false, skipLastStatisticsCheck = false) => {
        let currentStatisticsHash = btoa(JSON.stringify(statistics));
        let lastStatisticsHash = btoa(JSON.stringify(lastStatistics));
        if (skipLastStatisticsCheck || (currentStatisticsHash !== lastStatisticsHash || theStatisticsPanelWasDrawn === false)) {
            lastStatistics = statistics;

            let actions = ['add', 'update', 'delete'];
            $(`[data-gc2-layer-key]`).each((index, container) => {
                actions.map(action => {
                    $(container).find('.js-failed-' + action).addClass('hidden');
                    $(container).find('.js-failed-' + action).find('.js-value').html('');
                    $(container).find('.js-rejectedByServer-' + action).addClass('hidden');
                    $(container).find('.js-rejectedByServer-' + action).find('.js-value').html('');

                    $(container).find('.js-rejectedByServerItems').empty();
                    $(container).find('.js-rejectedByServerItems').addClass('hidden');
                });
            });

            $('.js-clear').addClass('hidden');
            $('.js-clear').off();

            $('.js-app-is-online-badge').addClass('hidden');
            $('.js-app-is-offline-badge').addClass('hidden');

            if ($('.js-app-is-online-badge').length === 1) {
                theStatisticsPanelWasDrawn = true;
            }

            if (statistics.online) {
                $('.js-toggle-offline-mode').prop('disabled', false);

                applicationIsOnline = 1;
                $('.js-app-is-online-badge').removeClass('hidden');
            } else {
                if (applicationIsOnline !== 0) {
                    $('.js-toggle-offline-mode').trigger('click');
                }

                $('.js-toggle-offline-mode').prop('disabled', true);

                applicationIsOnline = 0;
                $('.js-app-is-offline-badge').removeClass('hidden');
            }

            if (applicationIsOnline !== -1) {
                $('.js-app-is-pending-badge').remove();
            }

            for (let key in statistics) {
                let layerControlContainer = $(`[data-gc2-layer-key="${key}"]`);
                if (layerControlContainer.length === 1) {
                    let totalRequests = 0;
                    let rejectedByServerRequests = 0;
                    actions.map(action => {
                        if (statistics[key]['failed'][action.toUpperCase()] > 0) {
                            totalRequests++;
                            $(layerControlContainer).find('.js-failed-' + action).removeClass('hidden');
                            $(layerControlContainer).find('.js-failed-' + action).find('.js-value').html(statistics[key]['failed'][action.toUpperCase()]);
                        }

                        if (statistics[key]['rejectedByServer'][action.toUpperCase()] > 0) {
                            rejectedByServerRequests++;
                            totalRequests++;
                            $(layerControlContainer).find('.js-rejectedByServer-' + action).removeClass('hidden');
                            $(layerControlContainer).find('.js-rejectedByServer-' + action).find('.js-value').html(statistics[key]['rejectedByServer'][action.toUpperCase()]);
                        }
                    });

                    if (rejectedByServerRequests > 0) {
                        $(layerControlContainer).find('.js-rejectedByServerItems').removeClass('hidden');
                        statistics[key]['rejectedByServer'].items.map(item => {
                            let copiedItem = Object.assign({}, item.feature.features[0]);
                            let copiedItemProperties = Object.assign({}, item.feature.features[0].properties);
                            delete copiedItemProperties.gid;

                            let errorRecord = $(`<div>
                                <span class="label label-danger"><i style="color: black;" class="fa fa-exclamation"></i></span>
                                <button data-feature-geometry='${JSON.stringify(copiedItem.geometry)}' class="btn btn-secondary js-center-map-on-item" type="button" style="padding: 4px; margin-top: 0px; margin-bottom: 0px;">
                                    <i style="color: black;" class="fa fa-map-marker"></i>
                                </button>
                                <span style="color: gray; font-family: 'Courier New'">${JSON.stringify(copiedItemProperties)}</span>
                                <br/>
                                <div style="overflow: scroll;font-size: 12px; color: darkgray;">${item.serverErrorMessage}</div>
                            </div>`);

                            $(errorRecord).find('.js-center-map-on-item').click((event) => {
                                let geometry = $(event.currentTarget).data(`feature-geometry`);
                                if (geometry) {
                                    // Centering on non-point feature
                                    if (geometry.coordinates.length > 1) {
                                        let geojsonLayer = L.geoJson(geometry);
                                        let bounds = geojsonLayer.getBounds();
                                        cloud.get().map.panTo(bounds.getCenter());
                                    } else {
                                        cloud.get().map.panTo(new L.LatLng(geometry.coordinates[1], geometry.coordinates[0]));
                                    }
                                }
                            });

                            $(layerControlContainer).find('.js-rejectedByServerItems').append(errorRecord);
                        });
                    }

                    if (totalRequests > 0) {
                        $(layerControlContainer).find('.js-clear').removeClass('hidden');

                        $(layerControlContainer).find('.js-clear').on('click', (event) => {
                            let gc2Id = $(event.target).data('gc2-id');
                            if (!gc2Id) {
                                gc2Id = $(event.target).parent().data('gc2-id');
                            }

                            if (confirm(`${__('Cancel feature changes')}?`)) {
                                apiBridgeInstance.removeByLayerId(gc2Id);
                            }
                        });

                        $(layerControlContainer).find('.js-clear').hover(event => {
                            $(event.currentTarget).parent().find('.js-statistics-field').css('opacity', '0.2');
                        }, event => {
                            $(event.currentTarget).parent().find('.js-statistics-field').css('opacity', '1');
                        });
                    }
                }
            }
        }

        if (forceLayerUpdate) {
            _self.getActiveLayers().map(item => {
                switchLayer.init(item, false, true);
                switchLayer.init(item, true, true);
            });
        }
    },

    /**
     * Builds actual layer tree.
     */
    create: () => {
        var base64GroupName, arr, groups, metaData, i, l, count, displayInfo, tooltip;

        $("#layers").empty();

        let toggleOfllineOnlineMode = false;
        if (`serviceWorker` in navigator) {
            toggleOfllineOnlineMode = $(`<div class="panel panel-default">
                <div class="panel-body">
                    <div class="togglebutton">
                        <label>
                            <input class="js-toggle-offline-mode" type="checkbox"> ${__('Force offline mode')}
                            <span class="badge js-app-is-pending-badge" style="background-color: #C0C0C0;"><i class="fa fa-ellipsis-h"></i> ${__('Pending')}</span>
                            <span class="badge js-app-is-online-badge hidden" style="background-color: #28a745;"><i class="fa fa-signal"></i> Online</span>
                            <span class="badge js-app-is-offline-badge hidden" style="background-color: #dc3545;"><i class="fa fa-times"></i> Offline</span>
                        </label>
                    </div>
                </div>
            </div>`);

            if (apiBridgeInstance.offlineModeIsEnforced()) {
                $(toggleOfllineOnlineMode).find('.js-toggle-offline-mode').prop('checked', true);
            }

            $(toggleOfllineOnlineMode).find('.js-toggle-offline-mode').change((event) => {
                if ($(event.target).is(':checked')) {
                    apiBridgeInstance.setOfflineMode(true);
                } else {
                    apiBridgeInstance.setOfflineMode(false);
                }
            });
        } else {
            toggleOfllineOnlineMode = $(`<div class="alert alert-dismissible alert-warning" role="alert">
                <button type="button" class="close" data-dismiss="alert">×</button>
                ${__('This browser does not support Service Workers, some features may be unavailable')}
            </div>`);
        }

        $("#layers").append(toggleOfllineOnlineMode);

        groups = [];

        // Getting set of all loaded vectors
        metaData = meta.getMetaData();
        for (i = 0; i < metaData.data.length; ++i) {
            groups[i] = metaData.data[i].layergroup;
        }

        arr = array_unique(groups.reverse());
        metaData.data.reverse();

        // Filling up groups and underlying layers (except ungrouped ones)
        for (i = 0; i < arr.length; ++i) {
            if (arr[i] && arr[i] !== "<font color='red'>[Ungrouped]</font>") {
                l = [];
                base64GroupName = Base64.encode(arr[i]).replace(/=/g, "");

                // Add group container
                // Only if container doesn't exist
                // ===============================
                if ($("#layer-panel-" + base64GroupName).length === 0) {
                    $("#layers").append(`<div class="panel panel-default panel-layertree" id="layer-panel-${base64GroupName}">
                        <div class="panel-heading" role="tab">
                            <h4 class="panel-title">
                                <div class="layer-count badge">
                                    <span>0</span> / <span></span>
                                </div>
                                <a style="display: block" class="accordion-toggle" data-toggle="collapse" data-parent="#layers" href="#collapse${base64GroupName}">${arr[i]}</a>
                            </h4>
                        </div>
                        <ul class="list-group" id="group-${base64GroupName}" role="tabpanel"></ul>
                    </div>`);

                    // Append to inner group container
                    // ===============================
                    $("#group-" + base64GroupName).append(`<div id="collapse${base64GroupName}" class="accordion-body collapse"></div>`);
                }

                // Add layers
                // ==========
                for (var u = 0; u < metaData.data.length; ++u) {
                    let layer = metaData.data[u];
                    if (layer.layergroup == arr[i]) {
                        var text = (layer.f_table_title === null || layer.f_table_title === "") ? layer.f_table_name : layer.f_table_title;
                        if (layer.baselayer) {
                            $("#base-layer-list").append(`<div class='list-group-item'>
                                <div class='row-action-primary radio radio-primary base-layer-item' data-gc2-base-id='${layer.f_table_schema}.${layer.f_table_name}'>
                                    <label class='baselayer-label'>
                                        <input type='radio' name='baselayers'>${text}<span class='fa fa-check' aria-hidden='true'></span>
                                    </label>
                                </div>
                            </div>`);
                        } else {
                            let layerIsTheTileOne = true;
                            let layerIsTheVectorOne = true;

                            let isDisabledAttribute = '';
                            let selectorLabel = __('Tile');
                            let defaultLayerType = 'tile';

                            if (layer && layer.meta) {
                                let parsedMeta = JSON.parse(layer.meta);

                                if (parsedMeta) {
                                    displayInfo = (parsedMeta.meta_desc || layer.f_table_abstract) ? "visible" : "hidden";
                                }

                                if (parsedMeta.vidi_layer_type) {
                                    if (parsedMeta.vidi_layer_type === 't') {
                                        selectorLabel = __('Tile');
                                        isDisabledAttribute = 'disabled';
                                        layerIsTheVectorOne = false;
                                    }

                                    if (parsedMeta.vidi_layer_type === 'v') {
                                        defaultLayerType = 'vector';
                                        selectorLabel = __('Vector');
                                        isDisabledAttribute = 'disabled';
                                        layerIsTheTileOne = false;
                                    }
                                }
                            }

                            let layerKey = layer.f_table_schema + "." + layer.f_table_name;
                            let layerKeyWithGeom = layerKey + "." + layer.f_geometry_column;

                            if (layerIsTheVectorOne) {
                                store['v:' + layerKey] = new geocloud.sqlStore({
                                    jsonp: false,
                                    method: "POST",
                                    host: "",
                                    db: db,
                                    uri: "/api/sql",
                                    clickable: true,
                                    id: 'v:' + layerKey,
                                    name: 'v:' + layerKey,
                                    lifetime: 0,
                                    styleMap: styles['v:' + layerKey],
                                    sql: "SELECT * FROM " + layer.f_table_schema + "." + layer.f_table_name + " LIMIT 500",
                                    onLoad: (l) => {
                                        if (l === undefined) return;
                                        $('*[data-gc2-id-vec="' + l.id + '"]').parent().siblings().children().removeClass("fa-spin");

                                        layers.decrementCountLoading(l.id);
                                        backboneEvents.get().trigger("doneLoading:layers", l.id);
                                    },
                                    transformResponse: (response, id) => {
                                        return apiBridgeInstance.transformResponseHandler(response, id);
                                    },
                                    onEachFeature: onEachFeature['v:' + layerKey]
                                });
                            }

                            tooltip = layer.f_table_abstract || "";

                            let lockedLayer = (layer.authentication === "Read/write" ? " <i class=\"fa fa-lock gc2-session-lock\" aria-hidden=\"true\"></i>" : "");

                            let regularButtonStyle = `padding: 2px; color: black; border-radius: 4px; height: 22px; margin: 0px;`;
                            let queueFailedButtonStyle = regularButtonStyle + ` background-color: orange; padding-left: 4px; padding-right: 4px;`;
                            let queueRejectedByServerButtonStyle = regularButtonStyle + ` background-color: red; padding-left: 4px; padding-right: 4px;`;
                            let layerControlRecord = $(`<li class="layer-item list-group-item" data-gc2-layer-key="${layerKeyWithGeom}">
                                <div style="display: inline-block;">
                                    <div class="checkbox" style="width: 34px;">
                                        <label>
                                            <input type="checkbox"
                                                class="js-show-layer-control"
                                                id="${layer.f_table_name}"
                                                data-gc2-id="${layer.f_table_schema}.${layer.f_table_name}"
                                                data-gc2-layer-type="${defaultLayerType}">
                                        </label>
                                    </div>
                                </div>
                                <div style="display: inline-block;">
                                    <div class="dropdown">
                                        <button style="padding: 8px;" class="btn btn-default dropdown-toggle" type="button"
                                            data-toggle="dropdown" aria-haspopup="true" aria-expanded="true" ${isDisabledAttribute}>
                                            <span class="js-dropdown-label">${selectorLabel}</span>
                                            <span class="caret"></span>
                                        </button>
                                        <ul class="dropdown-menu">
                                            <li>
                                                <a class="js-layer-type-selector-tile" href="javascript:void(0)">${__('Tile')}</a>
                                            </li>
                                            <li>
                                                <a class="js-layer-type-selector-vector" href="javascript:void(0)">${__('Vector')}</a>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                                <div style="display: inline-block;">
                                    <span>${text}${lockedLayer}</span>
                                    <button type="button" class="hidden btn btn-sm btn-secondary js-statistics-field js-failed-add" style="${queueFailedButtonStyle}" disabled>
                                        <i class="fa fa-plus"></i> <span class="js-value"></span>
                                    </button>
                                    <button type="button" class="hidden btn btn-sm btn-secondary js-statistics-field js-failed-update" style="${queueFailedButtonStyle}" disabled>
                                        <i class="fa fa-edit"></i> <span class="js-value"></span>
                                    </button>
                                    <button type="button" class="hidden btn btn-sm btn-secondary js-statistics-field js-failed-delete" style="${queueFailedButtonStyle}" disabled>
                                        <i class="fa fa-minus-circle"></i> <span class="js-value"></span>
                                    </button>
                                    <button type="button" class="hidden btn btn-sm btn-secondary js-statistics-field js-rejectedByServer-add" style="${queueRejectedByServerButtonStyle}" disabled>
                                        <i class="fa fa-plus"></i> <span class="js-value"></span>
                                    </button>
                                    <button type="button" class="hidden btn btn-sm btn-secondary js-statistics-field js-rejectedByServer-update" style="${queueRejectedByServerButtonStyle}" disabled>
                                        <i class="fa fa-edit"></i> <span class="js-value"></span>
                                    </button>
                                    <button type="button" class="hidden btn btn-sm btn-secondary js-statistics-field js-rejectedByServer-delete" style="${queueRejectedByServerButtonStyle}" disabled>
                                        <i class="fa fa-minus-circle"></i> <span class="js-value"></span>
                                    </button>
                                    <button type="button" data-gc2-id="${layerKey}" class="hidden btn btn-sm btn-secondary js-clear" style="${regularButtonStyle}">
                                        <i class="fa fa-undo"></i>
                                    </button>
                                </div>
                                <div style="display: inline-block;">
                                    <button type="button" data-gc2-key="${layerKeyWithGeom}" style="padding: 8px;" 
                                        data-toggle="tooltip" data-placement="left" title="Add new feature to layer" data-layer-type="tile" class="btn gc2-add-feature gc2-edit-tools">
                                        <i class="fa fa-plus"></i>
                                    </button>
                                    <span data-toggle="tooltip" data-placement="left" title="${tooltip}"
                                        style="visibility: ${displayInfo}" class="info-label label label-primary" data-gc2-id="${layerKey}">Info</span>
                                </div>
                                <div class="js-rejectedByServerItems" hidden" style="width: 100%; padding-left: 15px; padding-right: 10px; padding-bottom: 10px;"></div>
                            </li>`);

                            $(layerControlRecord).find('.js-layer-type-selector-tile').first().on('click', (e) => {
                                let switcher = $(e.target).closest('.layer-item').find('.js-show-layer-control');
                                $(switcher).data('gc2-layer-type', 'tile');
                                $(switcher).prop('checked', true);
                                $(e.target).closest('.layer-item').find('.js-dropdown-label').text(__('Tile'));
                                _self.reloadLayer($(switcher).data('gc2-id'));
                            });

                            $(layerControlRecord).find('.js-layer-type-selector-vector').first().on('click', (e) => {
                                let switcher = $(e.target).closest('.layer-item').find('.js-show-layer-control');
                                $(switcher).data('gc2-layer-type', 'vector');
                                $(switcher).prop('checked', true);
                                $(e.target).closest('.layer-item').find('.js-dropdown-label').text(__('Vector'));
                                _self.reloadLayer('v:' + $(switcher).data('gc2-id'));
                            });

                            $("#collapse" + base64GroupName).append(layerControlRecord);

                            l.push({});
                        }
                    }
                }

                if (!isNaN(parseInt($($("#layer-panel-" + base64GroupName + " .layer-count span")[1]).html()))) {
                    count = parseInt($($("#layer-panel-" + base64GroupName + " .layer-count span")[1]).html()) + l.length;
                } else {
                    count = l.length;
                }

                $("#layer-panel-" + base64GroupName + " span:eq(1)").html(count);
                // Remove the group if empty
                if (l.length === 0) {
                    $("#layer-panel-" + base64GroupName).remove();
                }
            }
        }

        if (lastStatistics) {
            _self.statisticsHandler(lastStatistics, false, true);
        }
    },

    /**
     * Reloading provided layer.
     *
     * @param {String} layerId Layer identifier
     */
    reloadLayer: (layerId, forceTileRedraw = false) => {
        switchLayer.init(layerId, false, false, forceTileRedraw);
        switchLayer.init(layerId, true, false, forceTileRedraw);
    },


    /**
     * Returns list of currently enabled layers
     */
    getActiveLayers: () => {
        let activeLayerIds = [];
        $('*[data-gc2-layer-type]').each((index, item) => {
            let isEnabled = $(item).is(':checked');
            if (isEnabled) {
                if ($(item).data('gc2-layer-type') === 'tile') {
                    activeLayerIds.push($(item).data('gc2-id'));
                } else {
                    activeLayerIds.push('v:' + $(item).data('gc2-id'));
                }
            }
        });

        return activeLayerIds;
    },

    setOnEachFeature: function (layer, fn) {
        onEachFeature[layer] = fn;
    },

    setOnLoad: function (layer, fn) {
        onLoad[layer] = fn;
    },

    setOnSelect: function (layer, fn) {
        onSelect[layer] = fn;
    },

    setOnMouseOver: function (layer, fn) {
        onMouseOver[layer] = fn;
    },

    setCM: function (layer, c) {
        cm[layer] = c;
    },

    setStyle: function (layer, s) {
        styles[layer] = s;
    },

    setPointToLayer: function (layer, fn) {
        pointToLayer[layer] = fn;
    },

    setAutomatic: function (b) {
        automatic = b;
    },

    getStores: function () {
        return store;
    },

    load: function (id) {
        store[id].load();
    }
};
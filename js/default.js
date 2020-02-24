'use strict'

/* ****************************************
 * Variables
 */

var store = {
    imageDatas: [],
}
var temp = {
    dataUri: '',
}
var usingAxios = typeof axios !== 'undefined'
var $toast = null
var $cropModal = null
var $cropper = null

init()

/* ****************************************
 * Methods
 */

function init() {
    var endPointEl = document.getElementById('end-point')
    var keyEl = document.getElementById('key')
    var query = Qs.parse(location.search.replace(/^\?/, ''))

    if (usingAxios) {
        axios.defaults.headers.common['Content-Type'] = 'application/json'
    }

    if (document.getElementById('share')) {
        setClipboard(document.getElementById('share'), function() {
            var query = Qs.parse(location.search)

            query.endPoint = endPointEl.value
            query.key = keyEl.value

            var nextQuery = Qs.stringify(query)
            return location.origin + location.pathname + (nextQuery ? '?' + nextQuery : '')
        })
    }

    if (query.endPoint) {
        localStorage.setItem('endPoint', query.endPoint)
    }

    if (query.key) {
        localStorage.setItem('key', query.key)
    }

    if (localStorage.getItem('endPoint')) {
        endPointEl.value = localStorage.getItem('endPoint')
        setBaseUrl(localStorage.getItem('endPoint'))
    }

    if (localStorage.getItem('key')) {
        keyEl.value = localStorage.getItem('key')
        setSubscriptionKey(localStorage.getItem('key'))
    }

    loadStore()
    resetList()

    endPointEl.addEventListener('change', function(e) {
        var baseUrl = e.target.value || ''
        var nextBaseUrl = baseUrl

        nextBaseUrl = nextBaseUrl.replace(/^https?:\/\//, '')
        nextBaseUrl = nextBaseUrl.replace(/\/face$/, '')
        nextBaseUrl = nextBaseUrl.replace(/\/$/, '')

        localStorage.setItem('endPoint', nextBaseUrl)
        setBaseUrl(nextBaseUrl)
        if (baseUrl !== nextBaseUrl) endPointEl.value = nextBaseUrl
    })

    keyEl.addEventListener('change', function(e) {
        var subscriptionKey = e.target.value || ''

        localStorage.setItem('key', subscriptionKey)
        setSubscriptionKey(subscriptionKey)
    })

    document.getElementById('inputImageFile').addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            var file = e.target.files[0]

            file2DataUri(file, function(dataUri) {
                showCropModal(dataUri)
            })

            e.target.value = ''
        }
    })
}

function setBaseUrl(baseUrl) {
    if (usingAxios) {
        axios.defaults.baseURL = 'https://' + baseUrl
    }
}

function setSubscriptionKey(subscriptionKey) {
    if (usingAxios) {
        axios.defaults.headers.common['Ocp-Apim-Subscription-Key'] = subscriptionKey
    }
}

function saveStore() {
    localStorage.setItem('store', JSON.stringify(store))
}

function loadStore() {
    if (localStorage.getItem('store')) {
        try {
            store = JSON.parse(localStorage.getItem('store'))
        } catch (error) {
            // error
        }
    }
}

function convertDataFormat(imageUrl, data) {
    return {
        imageUrl: imageUrl,
        faceId: data.faceId,
        faceRectangle: {
            top: data.faceRectangle.top,
            left: data.faceRectangle.left,
            width: data.faceRectangle.width,
            height: data.faceRectangle.height,
        },
        faceAttributes: {
            gender: data.faceAttributes.gender,
            age: data.faceAttributes.age,
        },
    }
}

function resetList() {
    var listEl = document.querySelector('#list ul')
    var total = store.imageDatas.length

    while (listEl.firstChild) {
        listEl.removeChild(listEl.firstChild)
    }

    for (var key = 0; key < total; key++) {
        createListItem(store.imageDatas[key])
    }

    toggleClass(document.getElementById('list'), 'hasData', store.imageDatas.length > 0)
}

function createListItem(data) {
    var listEl = document.querySelector('#list ul')
    var el = getTemplate('list-item')
    var frameEl = document.createElement('div')
    var img = el.querySelector('img')
    var btnsWrapperEl = el.querySelector('.media-btns')
    var faceIdWrapperEl = el.querySelector('.bind-faceId')
    var imageUrlWrapperEl = el.querySelector('.bind-imageUrl')
    var resizeTimeout = 0
    var imgCb = function() {
        var imgRatio = img.clientWidth / img.naturalWidth
        var top = data.faceRectangle.top * imgRatio
        var height = data.faceRectangle.height * imgRatio
        var left = data.faceRectangle.left * imgRatio
        var width = data.faceRectangle.width * imgRatio

        frameEl.classList.add('media-image-frame')
        frameEl.style.top = top + 'px'
        frameEl.style.height = height + 'px'
        frameEl.style.left = left + 'px'
        frameEl.style.width = width + 'px'

        el.querySelector('.media-image').appendChild(frameEl)
    }

    img.src = data.imageUrl
    el.querySelector('.bind-gender').innerText = data.faceAttributes.gender
    el.querySelector('.bind-age').innerText = data.faceAttributes.age

    faceIdWrapperEl.querySelector('input').value = data.faceId
    setClipboard(faceIdWrapperEl.querySelector('button'), data.faceId, 'faceId가 복사되었습니다.')

    imageUrlWrapperEl.querySelector('input').value = data.imageUrl
    setClipboard(imageUrlWrapperEl.querySelector('button'), data.imageUrl, 'URL이 복사되었습니다.')

    listEl.appendChild(el)

    img.addEventListener('load', imgCb)
    window.addEventListener('resize', function(e) {
        if (img && window.getComputedStyle(img).visibility === 'visible') {
            clearTimeout(resizeTimeout)
            resizeTimeout = setTimeout(imgCb, 300)
        }
    })
    btnsWrapperEl.addEventListener('click', function(e) {
        if (e.type === 'click' && e.target.type === 'button' && e.target.dataset) {
            switch (e.target.dataset.action) {
                case 'delete':
                    var imageDataIndex = store.imageDatas.findIndex(function(imageData) {
                        return imageData.faceId === data.faceId
                    })

                    if (imageDataIndex !== -1) {
                        listEl.removeChild(el)
                        store.imageDatas.splice(imageDataIndex, 1)
                        toast('삭제되었습니다.')
                        saveStore()
                        toggleClass(document.getElementById('list'), 'hasData', store.imageDatas.length > 0)
                    }
                    break

                default:
                    break
            }
        }
    })
}

/**
 * Crop Modal 열기
 * @param {string} dataUri
 */
function showCropModal(dataUri) {
    var cropModalEl = document.getElementById('cropModal')
    var imgEl = document.getElementById('cropTargetImage')

    temp.dataUri = dataUri

    if (!temp.dataUri) {
        toast('파일이 없습니다.')
        return
    }

    if (!$cropModal) {
        $cropModal = $(cropModalEl).modal({
            show: false,
            backdrop: 'static',
        })

        $cropModal.on('shown.bs.modal', function() {
            $cropper = new Cropper(imgEl, {
                viewMode: 2,
                dragMode: 'move',
                minCanvasWidth: 36,
                minCanvasHeight: 36,
                minCropBoxWidth: 36,
                minCropBoxHeight: 36,
                toggleDragModeOnDblclick: false,
                guides: false,
            })
        })

        $cropModal.on('hidden.bs.modal', function() {
            if ($cropper) {
                $cropper.destroy()
            }
        })
    }

    imgEl.src = temp.dataUri
    $cropModal.modal('show')
}

function hideCropModal() {
    $cropModal.modal('hide')
}

function cropperZoomOut() {
    if ($cropper) {
        $cropper.zoom(-0.1)
    }
}

function cropperZoomIn() {
    if ($cropper) {
        $cropper.zoom(0.1)
    }
}

function cropperRotate() {
    if ($cropper) {
        $cropper.rotate(-90)
    }
}

function cropperSave() {
    if ($cropper) {
        $cropper.getCroppedCanvas({
            minWidth: 36,
            minHeight: 36,
            maxWidth: 1920,
            maxHeight: 1080,
            fillColor: '#fff',
            imageSmoothingQuality: 'high',
        }).toBlob(function(blob) {
            file2DataUri(blob, function(dataUri) {
                addFace({
                    blob: blob,
                    dataUri: dataUri,
                })
            })
        })
    }
}

/* ****************************************
 * Requests
 */

/**
 * 얼굴 등록하기
 * @param {{ file: Blob, dataUri: string }} fileData
 */
function addFace(fileData) {
    var apiUrl = '/face/v1.0/detect'
    var isUrl = !fileData
    var isFile = !isUrl

    var imageUrl = ''
    var params = {
        returnFaceId: 'true',
        returnFaceLandmarks: 'false',
        returnFaceAttributes: 'age,gender',
    }
    var body = null
    var headers = {}

    if (!localStorage.getItem('endPoint') || !localStorage.getItem('key')) {
        toast('End Point 또는 API Key가 입력되지 않았습니다.')
        return
    }

    if (isUrl) {
        imageUrl = document.getElementById('inputImage').value
        body = { url: imageUrl }

        if (!imageUrl) {
            toast('URL을 입력해주세요.')
            return
        }
    }

    if (isFile) {
        imageUrl = fileData.dataUri
        body = fileData.blob
        headers['content-type'] = 'application/octet-stream'
        hideCropModal()

        if (!imageUrl) {
            toast('파일이 없습니다.')
            return
        }
    }

    axios({
        method: 'post',
        url: apiUrl,
        params: params,
        data: body,
        headers: headers,
    })
        .then(response => {
            var data = response.data
            var total = data.length
            var addedCnt = 0

            if (total === 0) {
                toast('인식된 얼굴이 없습니다.')
                return
            }

            for (var key = 0; key < total; key++) {
                var val = data[key]
                var convertedData = convertDataFormat(imageUrl, val)
                var imageDataIndex = store.imageDatas.findIndex(function(imageData) {
                    return imageData.faceId === val.faceId
                })
                if (imageDataIndex === -1) {
                    addedCnt++
                    store.imageDatas.push(convertedData)
                    createListItem(convertedData)
                }
            }

            toggleClass(document.getElementById('list'), 'hasData', store.imageDatas.length > 0)
            toast('총 ' + addedCnt + '개의 얼굴이 추가되었습니다.')

            saveStore()
        })
        .catch(httpErrorHander)
        .then(function() {
            clearTemp()
        })
}

function clearTemp() {
    temp.dataUri = ''
}

function diffFace() {
    var apiUrl = '/face/v1.0/findsimilars'
    var faceId1El = document.getElementById('faceId1')
    var faceId2El = document.getElementById('faceId2')

    if (!localStorage.getItem('endPoint') || !localStorage.getItem('key')) {
        toast('End Point 또는 API Key가 입력되지 않았습니다.')
        return
    }

    if (!faceId1El.value || !faceId2El.value) {
        toast('비교할 faceId 2개를 입력해주세요.')
        return
    }

    axios({
        method: 'post',
        url: apiUrl,
        data: {
            faceId: faceId1El.value,
            faceIds: [faceId2El.value],
            mode: 'matchFace',
        },
    }).then(response => {
        var data = response.data

        if (data.length === 0) {
            toast('전혀 다른 사람이네요. :)')
            return
        }

        // persistedFaceId, faceId, confidence
        console.log(data)

        var similarity = Math.floor((data[0].confidence || 0) * 100)
        toast(similarity + '% 닮았습니다.')
    }).catch(httpErrorHander)
}

function httpErrorHander(error) {
    if (error.response) {
        var data = error.response.data
        var errorMsg = data.error
            ? data.error.code + ' : ' + data.error.message
            : error.response.status

        toast(errorMsg)
    } else if (error.request) {
        toast('서버에서 응답이 없습니다.')
    } else {
        toast('오류가 발생했습니다. ' + error.message)
    }
}

/* ****************************************
 * Utils
 */

/**
 * 템플릿 가져오기
 * @param {'list-item'} templateId
 */
function getTemplate(templateId) {
    var templateEl = document.querySelector('#templates #' + templateId)
    var cloneEl = templateEl.cloneNode(true)
    cloneEl.removeAttribute('id')
    return cloneEl
}

function toast(body) {
    var toastWrapperEl = document.getElementById('toast-wrapper')
    var toastEl = toastWrapperEl.querySelector('.toast')

    if (body) toastEl.querySelector('.bind-body').innerText = body

    if ($toast === null) {
        $toast = $(toastEl).toast({
            animation: true,
            autohide: true,
            delay: 3000,
        })

        $toast.on('show.bs.toast', function () {
            toastWrapperEl.classList.add('show')
        })

        $toast.on('hidden.bs.toast', function () {
            toastWrapperEl.classList.remove('show')
        })

        toastWrapperEl.addEventListener('click', function() {
            $toast.toast('hide')
        })
    }

    if (body) {
        $toast.toast('show')
    }
}

function setClipboard(selector, text, successMsg) {
    return new ClipboardJS(selector, {
        text: function() {
            switch (typeof text) {
                case 'string':
                    return text

                case 'function':
                    return text()

                default:
                    return ''
            }
        },
    }).on('success', function(e) {
        toast( successMsg || '복사되었습니다.')
        e.clearSelection()
    }).on('error', function() {
        toast('복사에 실패하였습니다.')
    })
}

function toggleClass(target, className, condition) {
    var el = typeof target === 'string'
        ? document.querySelector(target)
        : target

    if (typeof condition === 'function' ? condition() : !!condition) {
        el.classList.add(className)
        return el
    } else {
        el.classList.remove(className)
        return el
    }
}

function file2DataUri(file, callback) {
    var reader = new FileReader()
    reader.readAsDataURL(file)
    reader.addEventListener('load', function() {
        callback(reader.result)
    })
}

var store = {
    imageDatas: [],
}
var usingAxios = typeof axios !== 'undefined'
var $toast = null

init()

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

function init() {
    var endPointEl = document.getElementById('end-point')
    var keyEl = document.getElementById('key')

    if (usingAxios) {
        axios.defaults.headers.common['Content-Type'] = 'application/json'
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

        baseUrl = baseUrl.replace(/^https?:\/\//, '')
        baseUrl = baseUrl.replace(/\/face$/, '')
        baseUrl = baseUrl.replace(/\/$/, '')
        localStorage.setItem('endPoint', baseUrl)
        setBaseUrl(baseUrl)
    })

    keyEl.addEventListener('change', function(e) {
        var subscriptionKey = e.target.value || ''

        localStorage.setItem('key', subscriptionKey)
        setSubscriptionKey(subscriptionKey)
    })
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

function getInputImageEl() {
    return document.getElementById('inputImage')
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

function resetList() {
    var listEl = document.querySelector('#list ul')
    var total = store.imageDatas.length

    while (listEl.firstChild) {
        listEl.removeChild(listEl.firstChild)
    }

    for (var key = 0; key < total; key++) {
        createListItem(store.imageDatas[key])
    }

    if (total > 0) {
        document.getElementById('list').classList.add('hasData')
    }
}

function createListItem(data) {
    var listEl = document.querySelector('#list ul')
    var el = getTemplate('list-item')
    var frameEl = document.createElement('div')
    var img = el.querySelector('img')

    img.src = data.imageUrl
    el.querySelector('.bind-faceId').value = data.faceId
    el.querySelector('.bind-imageUrl').value = data.imageUrl
    el.querySelector('.bind-gender').innerText = data.faceAttributes.gender
    el.querySelector('.bind-age').innerText = data.faceAttributes.age

    listEl.appendChild(el)

    img.onload = function() {
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
}

function addFace() {
    var apiUrl = '/face/v1.0/detect'

    var params = {
        returnFaceId: 'true',
        returnFaceLandmarks: 'false',
        returnFaceAttributes: 'age,gender',
    }

    var imageUrl = getInputImageEl().value

    if (!imageUrl) {
        toast('URL을 입력해주세요.')
        return
    }

    axios({
        method: 'post',
        url: apiUrl,
        params: params,
        data: { url: imageUrl },
    }).then(response => {
        var data = response.data
        var total = data.length
        var addedCnt = 0
        var listEl = document.querySelector('#list ul')

        if (total === 0) {
            observer.disconnect()
            listEl.classList.remove('hasData')
            toast('인식된 얼굴이 없습니다.')
            return
        }

        document.getElementById('list').classList.add('hasData')

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

        setTimeout(function() {
            toast('총 ' + addedCnt + '개의 얼굴이 추가되었습니다.')
        }, 200)

        saveStore()
    }).catch(error => {
        console.error(error)
        toast('에러가 발생하였습니다.')
    })
}

function diffFace() {
    var apiUrl = '/face/v1.0/findsimilars'
    var faceId1El = document.getElementById('faceId1')
    var faceId2El = document.getElementById('faceId2')

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
    }).catch(error => {
        console.error(error)
        toast('에러가 발생하였습니다.')
    })
}

function toast(body) {
    var toastWrapperEl = document.getElementById('toast-wrapper')
    var toastEl = toastWrapperEl.querySelector('.toast')

    if (body) toastEl.querySelector('.bind-body').innerText = body

    if ($toast === null) {
        $toast = $(toastEl).toast({
            animation: true,
            autohide: true,
            delay: 2000,
        })

        $toast.on('show.bs.toast', function () {
            toastWrapperEl.classList.add('show')
        })

        $toast.on('hidden.bs.toast', function () {
            toastWrapperEl.classList.remove('show')
        })
    }

    if (body) {
        $toast.toast('show')
    }
}
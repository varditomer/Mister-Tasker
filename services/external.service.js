const utilService = require('./util.service')

module.exports = {
    execute
}

function execute() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (Math.random() > 0.5) resolve(parseInt(Math.random() * 100))
            // throw some more random errors 
            else reject(utilService.makeLorem(utilService.getRandomInt(2, 7)).trim());
        }, 5000)
    })
}

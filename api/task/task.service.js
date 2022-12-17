const externalService = require('../../services/external.service')
const dbService = require('../../services/db.service')
const logger = require('../../services/logger.service')
const utilService = require('../../services/util.service')
const ObjectId = require('mongodb').ObjectId
const socketService = require('../../services/socket.service')

async function query(filterBy = { txt: '' }) {
    try {
        const criteria = {
            title: { $regex: filterBy.txt, $options: 'i' }
        }
        const collection = await dbService.getCollection('task')
        var tasks = await collection.find(criteria).toArray()
        return tasks
    } catch (err) {
        logger.error('cannot find tasks', err)
        throw err
    }
}

async function getById(taskId) {
    try {
        const collection = await dbService.getCollection('task')
        const task = collection.findOne({ _id: ObjectId(taskId) })
        return task
    } catch (err) {
        logger.error(`while finding task ${taskId}`, err)
        throw err
    }
}

async function remove(taskId) {
    try {
        const collection = await dbService.getCollection('task')
        await collection.deleteOne({ _id: ObjectId(taskId) })
        return taskId
    } catch (err) {
        logger.error(`cannot remove task ${taskId}`, err)
        throw err
    }
}

async function add(task) {
    try {
        const collection = await dbService.getCollection('task')
        await collection.insertOne(task)
        return task
    } catch (err) {
        logger.error('cannot insert task', err)
        throw err
    }
}
async function performTask(task) {
    try {
        // update task status to running and save to DB 
        task.status = 'running'
        var updatedTask = await update(task)
        socketService.emitTo({ type: 'task-updated', data: updatedTask })
        // execute the task using: externalService.execute 
        await externalService.execute(updatedTask)
        // update task for success (doneAt, status) 
        updatedTask.status = 'done'
        updatedTask.doneAt = Date.now()
    } catch (error) {
        // update task for error: status, errors 
        updatedTask.status = 'failed'
        updatedTask.errors.push(error)
    } finally {
        // update task lastTried, triesCount and save to DB 
        updatedTask.lastTriedAt = Date.now()
        updatedTask.triesCount += 1
        socketService.emitTo({ type: 'task-updated', data: updatedTask })
        return await update(updatedTask)
    }
}

async function update(task) {
    try {
        const taskToSave = {
            title: task.title,
            status: task.status,
            description: task.description,
            importance: task.importance,
            createdAt: task.createdAt,
            lastTriedAt: task.lastTriedAt,
            triesCount: task.triesCount,
            doneAt: task.doneAt,
            errors: task.errors,
        }
        const collection = await dbService.getCollection('task')
        await collection.updateOne({ _id: ObjectId(task._id) }, { $set: taskToSave })
        return task
    } catch (err) {
        logger.error(`cannot update task ${task._id}`, err)
        throw err
    }
}

async function getNextTask() {
    const tasks = await query()
    const unDoneTasks = tasks.filter(task => (task.status !== 'done' && task.triesCount <= 5))
    const sortedTasks = unDoneTasks.sort((taskA, taskB) => taskB.importance - taskA.importance)
    console.log(`sortedTasks:`, sortedTasks)
    return sortedTasks[0]
}


async function addTaskMsg(taskId, msg) {
    try {
        msg.id = utilService.makeId()
        const collection = await dbService.getCollection('task')
        await collection.updateOne({ _id: ObjectId(taskId) }, { $push: { msgs: msg } })
        return msg
    } catch (err) {
        logger.error(`cannot add task msg ${taskId}`, err)
        throw err
    }
}

async function removeTaskMsg(taskId, msgId) {
    try {
        const collection = await dbService.getCollection('task')
        await collection.updateOne({ _id: ObjectId(taskId) }, { $pull: { msgs: { id: msgId } } })
        return msgId
    } catch (err) {
        logger.error(`cannot add task msg ${taskId}`, err)
        throw err
    }
}

module.exports = {
    remove,
    query,
    getById,
    add,
    update,
    addTaskMsg,
    removeTaskMsg,
    performTask,
    getNextTask
}

//middlewares
import { param } from 'express-validator';

//controllers
import CounterController  from './counter.controller.ts';

export const CounterValidator = {
    getCounter: [
        param('name').custom(CounterController.validateRedisKey),
    ],

    incrementCounter: [
        param('name').custom(CounterController.validateRedisKey),
    ],

    decrementCounter: [
        param('name').custom(CounterController.validateRedisKey),
    ],

    resetCounter: [
        param('name').custom(CounterController.validateRedisKey),
    ],
};  
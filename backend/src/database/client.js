import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'node:crypto'
import { read } from 'node:fs'
//import { Database } from './supabase.ts'

const supabase = createClient("https://rjthnnssesqanaoajosf.supabase.co", 'sb_publishable_TeALc7C1vB4w0XIDLjZjUw_V2jxIEKi')

export async function readOneRow (idNumber){
    const { data: sampleQuery, error } = await supabase
        .from('powerReadings')
        .select()
        .eq('id', idNumber)
        if(error){  // Logs the full error: message, code, details, and hint.
        console.error(error)
        }
        else if (sampleQuery){
        console.log(sampleQuery)
        }
}

export async function readAllRows (){
    const { data: sampleQuery, error } = await supabase
        .from('powerReadings')
        .select()
        if(error){  // Logs the full error: message, code, details, and hint.
        console.error(error)
        }
        else if (sampleQuery){
        console.log(sampleQuery)
        }
}

export async function randomInsertion(){
    const {data: insertQuery, error} = await supabase
        .from('powerReadings')
        .insert({port0_power: (Math.random() * 100),
                port1_power: (Math.random() * 100),
                port2_power: (Math.random() * 100),
                port3_power: (Math.random() * 100),
                port4_power: (Math.random() * 100),
                port5_power: (Math.random() * 100),
                port6_power: (Math.random() * 100),
                port7_power: (Math.random() * 100)
        })
        if(error){  // Logs the full error: message, code, details, and hint.
        console.error(error)
        }
}
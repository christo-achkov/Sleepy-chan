import { Client, MessageEmbed } from 'discord.js';
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import config from "../config.js";

const FBApp = initializeApp(config["FIREBASE_CONFIG"]);
const db = getFirestore();
const client = new Client();

client.login(config["DISCORDJS_BOT_TOKEN"]);

client.on('ready', () => {
    console.log(`${client.user.username} has logged in successfully!`);
    console.log(`Currently set prefix is "${config["PREFIX"]}".`)

    client.user.setActivity(`${config["PREFIX"]}help for commands`);
});

client.on('message', (message) => {
    if (message.content.startsWith(config["PREFIX"] + "help"))
        _help(message);

    if (message.content.startsWith(config["PREFIX"] + "add")) {
        if (message.member.permissions.has('MANAGE_ROLES'))
            _add(message)
        else
            message.reply(`You don't have manage roles permission.`);
    }
})

function _help(message) {
    const channel = client.channels.cache.get(message.channel.id);

    const exampleEmbed = new MessageEmbed()
        .setColor(process.env.EMBED_COLOR)
        .setTitle('List of available commands')
        .addFields(
            { name: 'Add assign role', value: '*add <role> <emoji>' },
            { name: 'Remove assign role', value: '*remove <role>' },
            { name: 'Post role assign message', value: '*post' },
        )
        .setImage('https://i.imgur.com/4rBSvs3.png')
        .setTimestamp()
        .setFooter('Zzzzz....');

    channel.send(exampleEmbed);
}

function _add(message) {
    const channel = client.channels.cache.get(message.channel.id);

    console.log(channel);
}


import { Client, MessageEmbed } from 'discord.js';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, arrayUnion, arrayRemove, updateDoc } from "firebase/firestore";
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
            message.reply(`you don't have manage roles permission.`);
    }
})

function _help(message) {
    const channel = client.channels.cache.get(message.channel.id);

    const embed = new MessageEmbed()
        .setColor(config["EMBED_COLOR"])
        .setTitle('List of available commands')
        .addFields(
            { name: 'Add assign role', value: '*add <role> <emoji>' },
            { name: 'Remove assign role', value: '*remove <role>' },
            { name: 'Post role assign message', value: '*post' },
        )
        .setImage('https://i.imgur.com/4rBSvs3.png')
        .setTimestamp()
        .setFooter('Zzzzz....');

    channel.send(embed);
}

async function _add(message) {
    // checks if message fits the desired format (*add role emoji)
    const regex = new RegExp("^\\*add <@&(\\d+)> ((?:<:\\S+?:(\\d+?)>|\\S+?))$", "gm");
    const match = regex.exec(message.content);

    if (!match) {
        message.reply("invalid format. Try '*add <role> <emoji>'.");
        return;
    }

    const roleId = match[1];
    const emoji = match[2];
    const emojiId = _isUTFEmoji(emoji) ? emoji : match[3]; // if its UTF emoji we return the emoji itself as ID

    if (!_roleExists(message, roleId)) {
        message.reply("role does not exist or I have not access to it.");
        return;
    }

    if (!_isUTFEmoji(emojiId) && !_emojiExists(message, emojiId)) {
        message.reply("invalid emoji or emoji is from another server.");
        return;
    }

    const docRef = doc(db, `${message.channel.guild.id}`, "assign-roles");
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        const newData = { "entries": [{ "role": roleId, "emoji": emoji }] };
        await setDoc(docRef, newData);
    } else {
        const data = docSnap.data();
        if (data["entries"].some(entry => entry.role == roleId || entry.emoji == emoji)) {
            message.reply(`role <@&${roleId}> is already added or ${emoji} is already used.`);
            return;
        }

        await updateDoc(docRef, {
            entries: arrayUnion({ "role": roleId, "emoji": emoji })
        });
    }

    message.reply(`role <@&${roleId}> with react emote ${emoji} was added successfully!`)
    _list(message);
}

async function _list(message) {
    const channel = client.channels.cache.get(message.channel.id);

    const docRef = doc(db, `${message.channel.guild.id}`, "assign-roles");
    const docSnap = await getDoc(docRef)
    const data = docSnap.data();

    const fields = data["entries"].map(entry => ({ name: `${entry.emoji}`, value: `<@&${entry.role}>`, inline: true }));

    const embed = new MessageEmbed()
        .setColor(config["EMBED_COLOR"])
        .setTitle('Assigned roles')
        .addFields(
            fields
        )

    channel.send(embed);
}

function _roleExists(message, id) {
    return !!message.guild.roles.cache.get(id);
}

function _emojiExists(message, emojiId) {
    return !!message.guild.emojis.cache.get(emojiId)
}

function _isUTFEmoji(input, includeBasic = true) {
    try {
        for (let c of input) {
            let cHex = ("" +
                c).codePointAt(0).toString(16);
            let lHex = cHex.length;
            if (lHex > 3) {
                let prefix = cHex.substring(0, 2);

                if (lHex == 5 && prefix == "1f") {
                    return true;
                }
                if (includeBasic && lHex == 4) {
                    if (["20", "21", "23", "24", "25", "26", "27", "2B", "29", "30", "32"].indexOf(prefix) > -1)
                        return true;
                }
            }
        }
        return false;
    } catch {
        return false;
    }
}





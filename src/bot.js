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
    if (message.content.startsWith(config["PREFIX"] + "help")) {
        _help(message);
    }

    const isAdd = message.content.startsWith(config["PREFIX"] + "add");
    const isRemove = message.content.startsWith(config["PREFIX"] + "remove");
    const isPost = message.content.startsWith(config["PREFIX"] + "post");
    const hasPermission = message?.member?.permissions?.has('MANAGE_ROLES');

    if (isAdd && hasPermission)
        _add(message)

    if (isRemove && hasPermission)
        _remove(message)

    if (isPost && hasPermission)
        _post(message)

    if ((isAdd || isRemove || isPost) && !hasPermission)
        message.reply(`you don't have manage roles permission.`);
})

client.on('messageReactionAdd', async (reaction, user) => {
    _handleRole("ADD", reaction, user);
})

client.on('messageReactionRemove', async (reaction, user) => {
    _handleRole("REMOVE", reaction, user);
})

async function _handleRole(type, reaction, user) {
    if (reaction.message.author.username != config["BOT_NAME"] || user.username == config["BOT_NAME"]) return;

    const docRef = doc(db, `${reaction.message.channel.guild.id}`, "assign-roles");
    const docSnap = await getDoc(docRef)
    const assignRoles = docSnap.data()['entries'];

    const roleToAdd = assignRoles.find(entry => entry.emoji.includes(reaction.emoji.id) || entry.emoji.includes(reaction.emoji.name))

    if (!roleToAdd || roleToAdd.length == 0) return;

    let role = reaction.message.guild.roles.cache.get(roleToAdd.role);
    const channel = client.channels.cache.get(reaction.message.channel.id);
    const guildMember = reaction.message.guild.member(user);

    if (type == "ADD") {
        await guildMember.roles.add(role);

        const message = await channel.send(`<@${user.id}>, assigned ${roleToAdd.emoji}.`);
        setTimeout(() => {
            message.delete();
        }, 5000);
    }

    if (type == "REMOVE") {
        await guildMember.roles.remove(role);

        const message = await channel.send(`<@${user.id}>, removed ${roleToAdd.emoji}.`);

        setTimeout(() => {
            message.delete();
        }, 5000);
    }
}

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
        .setImage(config["HELP_THUMBNAIL"])
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
    const newRole = { "role": roleId, "emoji": emoji };

    if (!docSnap.exists()) {
        const newData = { "entries": [newRole] };
        await setDoc(docRef, newData);
    } else {
        const data = docSnap.data();
        if (data["entries"].some(entry => entry.role == roleId || entry.emoji == emoji)) {
            message.reply(`role <@&${roleId}> is already added or ${emoji} is already used.`);
            return;
        }

        await updateDoc(docRef, {
            entries: arrayUnion(newRole)
        });
    }

    message.reply(`role <@&${roleId}> with react emote ${emoji} was added successfully!`)
    _listChange(message, newRole, "NEW");
}

async function _remove(message) {
    const regex = new RegExp("^\\*remove <@&(\\d+)>$", "gm");
    const match = regex.exec(message.content);

    if (!match) {
        message.reply("invalid format. Try '*remove <role>'");
        return;
    }

    const roleId = match[1];
    const docRef = doc(db, `${message.channel.guild.id}`, "assign-roles");
    const docSnap = await getDoc(docRef)

    if (docSnap.exists() && docSnap.data()["entries"].some(entry => entry.role == roleId)) {
        const entry = docSnap.data()["entries"].find(entry => entry.role == roleId);

        await updateDoc(docRef, {
            entries: arrayRemove(entry)
        });

        message.reply(`the role <@&${entry.role}> has been removed successfully.`)

        _listChange(message, entry, "REMOVED", true);
    } else {
        message.reply(`the role <@&${roleId}> does not seem to have been added to assign roles.`)
    }
}

async function _post(message) {
    const channel = client.channels.cache.get(message.channel.id);

    const docRef = doc(db, `${message.channel.guild.id}`, "assign-roles");
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists() || docSnap.data()["entries"].length == 0) {
        message.reply("there are no entries yet. Try adding some with the *add command.");
        return;
    }

    const data = docSnap.data();

    const fields = data["entries"].map(entry => ({
        name: `${entry.emoji}`,
        value: `<@&${entry.role}>`,
        inline: true
    }));

    const embed = new MessageEmbed()
        .setTitle("React to add/remove ping role~")
        .setColor(config["EMBED_COLOR"])
        .addFields(
            fields
        )
        .setImage(config["POST_THUMBNAIL"])

    const reactionMessage = await channel.send(embed);

    data["entries"].forEach(entry => {
        reactionMessage.react(`${entry.emoji}`);
    });
}

async function _listChange(message, newRole, info, remove = false) {
    const channel = client.channels.cache.get(message.channel.id);

    const docRef = doc(db, `${message.channel.guild.id}`, "assign-roles");
    const docSnap = await getDoc(docRef)
    const data = docSnap.data();

    const fields = data["entries"].map(entry => ({
        name: entry.role == newRole.role ? `${info} -> ${entry.emoji}` : `${entry.emoji}`,
        value: `<@&${entry.role}>`,
        inline: true
    }));

    if (remove) {
        fields.push({ name: `${info} -> ${newRole.emoji}`, value: `<@&${newRole.role}>`, inline: true })
    }

    const embed = new MessageEmbed()
        .setColor(config["EMBED_COLOR"])
        .addFields(
            fields
        )
        .setImage(config["LIST_THUMBNAIL"])
        .setTimestamp()
        .setFooter('Yawn... Anything else?~');

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






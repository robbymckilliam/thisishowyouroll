/* 
   Calculator for DnD dice rolls
    Copyright (C) 2016  Robby McKilliam

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. 
*/

function regenerate_results() {
    document.getElementById("requiredroll").innerHTML = ""
    document.getElementById("diceresults").innerHTML = ""
    document.getElementById("bestroll").innerHTML = ""

    // strip whitespace from form string
    var inputstring = document.getElementById("rollstring").value.replace(/ /g,'')

    if( inputstring.length == 0 ) {
	set_help_visible();
	return;
    }

    set_data_visible();
    
    // setup plot
    if( plothidden == false ) {
	pmfplot = c3.generate({
	    bindto: '#pmfplot',
	    data: {
		columns: [],
		type: 'area-step'
	    },
	    title: {
		text: 'Probability of success'
	    },
	    size: {
		height: 240
	    }
	});
    }

    process_requirements(inputstring);

}

// stops buttons from stealing focus
$(document).ready(function () {
  $(".btn").click(function(event) {
    $(this).blur();
  });
});

function process_requirements(inputstring) {
    if( inputstring.length == 0 ) {
	return;
    } 

    var isplit = inputstring.split("with");

    // error if not one "with" keyword
    if( isplit.length != 2 ) {
	document.getElementById("requiredroll").innerHTML += "<strong><span style=\"color: red;\">Error:</span></strong> keyword <strong>with</strong> must occur once<br>";
	return;
    }
    
    var required = isplit[0];
    var rolls = isplit[1];
    	document.getElementById("requiredroll").innerHTML += "<strong>Require:</strong> " + required + "<br>";
    var bestroll = process_all_dice_rolls(rolls, required);
    console
    if( bestroll[1] > 0.5 ) {
		document.getElementById("bestroll").innerHTML += "<strong>You should roll</strong> " + bestroll[0];
    }
    else {
	document.getElementById("bestroll").innerHTML +="<strong>You should run away!</strong>";
    }
}

// Computes probability of each roll, return best roll
function process_all_dice_rolls(inputstring, required) {
    var rolls = inputstring.split("or");
    var bestroll = "";
    var bestprob = -1;
    for(var i in rolls) {

	if( plothidden == false )
	    plot_success_prob(rolls[i]);
	try {
	    var succprob = process_multiple_rolls(rolls[i],required);

	    document.getElementById("diceresults").innerHTML += "<tr><td>" + rolls[i] + "</td><td>" + succprob + "</td></tr>";
	    if( succprob > bestprob ) {
		bestprob = succprob;
		bestroll = rolls[i];
	    }
	} catch(err) {
	    document.getElementById("diceresults").innerHTML += "<tr><td>" + rolls[i] + "</td><td>" + err + "</td></tr>";
	}
	
    }
    return [bestroll,  bestprob];
}

function plot_success_prob(roll) {

    // roll string at start of array for c3 plot label
    var plotsp = [roll];

    var r = 0;
    var sp = 1.0;
    while (sp > 0.0) {
	sp = process_multiple_rolls(roll,r);
	plotsp.push(sp);
	r = r+1;
    }
    
    // load data input plot
    pmfplot.load({
	columns: [
	    plotsp
	]
    });
    
}

// process "iffail" allowing rolling again after they fail
function process_multiple_rolls(input, required){
    var rolls = input.split("iffail");
    var prob = 1.0;
    for( var x in rolls ) {
	var rollprob = dice_roll_success_probability(rolls[x], required);
	prob = prob*(1-rollprob);
    }
    return 1 - prob;
}

// compute probability of succes of a roll
function dice_roll_success_probability(roll, required) {
    var pmf = process_dice_roll(roll);    
    if( required <= 0 ) {
	return 1.0;
    }
    if( pmf.length <= required ) {
	return 0.0;
    }
    var sum = 0.0;
    for(var n = Math.ceil(required); n < pmf.length; n++) {
	sum  = sum + pmf[n];
    }
    return sum;
}

// Return cumulative mass function of dice roll
function dice_roll_cmf(roll) {
    var pmf = process_dice_roll(roll);    
    var sum = 0.0;
    var cmf = [];
    for(var n = 0; n < pmf.length; n++) {
	sum  = sum + pmf[n];
	cmf.push(sum);
    }
    return cmf;
}

// Returns probablily mass funcion of the roll
// split individual dice with "+" and compute probability mass
// function of each dice.
function process_dice_roll(input) {
    var rolls = input.split("+");
    prob = [1.0];
    for (var i in rolls) {
	var rollprob = process_dice(rolls[i]);
	prob = conv(prob, rollprob);
    }    
    return prob;
}

// splits DnD dice notation, e.g., 4d6 into number of rolls
// and dice. Returns probability distribution.
function process_dice(inputstring) {
    var dice = inputstring.split("d");
    var num_rolls = 1;      //number of rolls (1 if ommited)
    if( dice[0].length != 0 ) {
	num_rolls = dice[0];
	if( !is_number(num_rolls) ) throw "<strong><span style=\"color: red;\">Error:</span></strong> invalid number of rolls \"" + num_rolls + "\""
    }
    // if not "dD" component then assume D=1
    // eg  4d6+1 interpretted as 4d6+1d1
    var dice_type = "1";
    if( dice.length > 1 ) {
	dice_type = dice[1]; // type of dice
    }
    var dprob = modifiedDiceProbability(dice_type);
    var prob = [1.0];
    for(var i = 0; i < num_rolls; i++) {
	prob = conv(prob,dprob);
    }
    return prob;
}

// discrete convolvution of two arrays
function conv(x,y) {
    function inner(n) {
	var sum=0;
	for(var m in x) {
	    if( n - m >= 0 ) {
		if( n - m < y.length ) {
		    sum = sum + x[m]*y[n-m];
		}
	    }
	}
	return sum;
    }
    var len = x.length + y.length - 1;
    var ret = [];
    for(var n = 0; n< len; n++){
	ret.push(inner(n));
    }
    return ret;
}

// process dice modifications (dogslicer for example)
// this are included by adding the notation
// 1d6m1>3
// meaning replace 1d6 with 1's replaced by 3's.
function modifiedDiceProbability(inputstring) {
    var dice = inputstring.split("where");
    var dice_type = dice[0];
    if( !is_number(dice_type) ) throw "<strong><span style=\"color: red;\">Error:</span></strong> invalid dice \"" + dice_type + "\""
    var prob = standardDiceProbability(dice_type);
    for( var i = 1; i < dice.length; i++ ) {  
	prob = modifyDice(prob, dice[i]);
    }
    return prob;
}

function modifyDice(prob, modifier) {
    var dice = modifier.split("is");

    if( dice.length != 2 ) 
	throw "<strong><span style=\"color: red;\">Error:</span></strong> keyword <strong>where</strong> without <strong>is</strong>";
    
    var a = dice[0];
    var b = dice[1];

    if( !is_number(a) ) throw "<strong><span style=\"color: red;\">Error:</span></strong> invalid string \"" + a + "\" before keyword <strong>is</strong>"
    if( !is_number(b) ) throw "<strong><span style=\"color: red;\">Error:</span></strong> invalid string \"" + b + "\" after keyword <strong>is</strong>"
    
    prob[b] = prob[a] + prob[b];
    prob[a] = 0.0;
    return prob;
}

// pmf of an n sided dice (returned as array)
function standardDiceProbability(n) {
    var prob = [0.0];
    for(var p = 0; p < n; p++){
	prob.push(1.0/n);
    }
    return prob;
}

function set_help_visible() {
    document.getElementById("diceresultsontainer").className="container hidden";
    document.getElementById("plotcontainer").className="container hidden";
    document.getElementById("helpcontainer").className="container";
}

function set_data_visible() {
    document.getElementById("helpcontainer").className="container hidden";
    if( plothidden == false ) {
	document.getElementById("diceresultsontainer").className="container hidden";
	document.getElementById("plotcontainer").className="container";
    } else {
	document.getElementById("plotcontainer").className="container hidden";
	document.getElementById("diceresultsontainer").className="container";
    }
}

/// Returns true if x is a string containing only numbers, otherwise false
function is_number(x) {
    return /^\d+$/.test(x);
}

var plothidden=true
function button_switch_stats() {
    console.log("Pressed stats button");
    
    if( plothidden == true ) 
	plothidden = false;
    else 
	plothidden = true;

    set_data_visible();
    regenerate_results();
}

function button_1() {
    document.getElementById("rollstring").value += "1";
    regenerate_results();
}
function button_2() {
    document.getElementById("rollstring").value += "2";
    regenerate_results();
}
function button_3() {
    document.getElementById("rollstring").value += "3";
    regenerate_results();
}
function button_4() {
    document.getElementById("rollstring").value += "4";
    regenerate_results();
}
function button_5() {
    document.getElementById("rollstring").value += "5";
    regenerate_results();
}
function button_6() {
    document.getElementById("rollstring").value += "6";
    regenerate_results();
}
function button_7() {
    document.getElementById("rollstring").value += "7";
    regenerate_results();
}
function button_8() {
    document.getElementById("rollstring").value += "8";
    regenerate_results();
}
function button_9() {
    document.getElementById("rollstring").value += "9";
    regenerate_results();
}
function button_0() {
    document.getElementById("rollstring").value += "0";
    regenerate_results();
}
function button_is() {
    document.getElementById("rollstring").value += " is ";
    regenerate_results();
}
function button_plus() {
    document.getElementById("rollstring").value += " + ";
    regenerate_results();
}
function button_d() {
    document.getElementById("rollstring").value += "d";
    regenerate_results();
}
function button_where() {
    document.getElementById("rollstring").value += " where ";
    regenerate_results();
}
function button_iffail() {
    document.getElementById("rollstring").value += " iffail ";
    regenerate_results();
}
function button_or() {
    document.getElementById("rollstring").value += " or ";
    regenerate_results();
}
function button_with() {
    document.getElementById("rollstring").value += " with ";
    regenerate_results();
}
function button_CLEAR() {
    //console.log("Not yet implemented");
    document.getElementById("rollstring").value = ""
    regenerate_results();
}
function button_BACK() {
    var s = document.getElementById("rollstring").value

    // removes a character while stripping whitespace
    while( s[s.length-1 ] == " " ) 
	s=s.slice(0,-1)
    s=s.slice(0,-1)
    while( s[s.length-1 ] == " " ) 
	s=s.slice(0,-1)
    
    document.getElementById("rollstring").value = s
    regenerate_results();
}

///////////////////////////////////////////////////////////
/// Some tests

function test_modifyDice() {
    //document.write("<br><br>modifyDice test running<br>");
    var prob1 = modifyDice([0,0.5,0.5], "1is2");
    if( prob1[0] != 0 ) document.write("<br>modifyDice test FAILED!<br>");
    if( prob1[1] != 0 ) document.write("modifyDice test FAILED!<br>");
    if( prob1[2] != 1 ) document.write("modifyDice test FAILED!<br>");
}

function test_modifiedDiceProbability() {    
    var failstring = "<br>modifiedDiceProbability test FAILED!";

    var prob = modifiedDiceProbability("2");
    if( prob[0] != 0 ) document.write(failstring);
    if( prob[1] != 0.5 ) document.write(failstring);
    if( prob[2] != 0.5 ) document.write(failstring);    

    var prob = modifiedDiceProbability("2where1is2");
    if( prob[0] != 0 ) document.write(failstring);
    if( prob[1] != 0 ) document.write(failstring);
    if( prob[2] != 1 ) document.write(failstring);    
}

function test_iffail() {    
    var failstring = "<br>iffail test FAILED!";
  
    var prob = process_multiple_rolls("2iffail1", 1);
    if( prob != 1 ) document.write(failstring);

    var prob = process_multiple_rolls("2iffail1", 3);
    if( prob != 0 ) document.write(failstring);

    var prob = process_multiple_rolls("d4iffail2", 3);
    if( prob != 0.5 ) document.write(failstring);

    var prob = process_multiple_rolls("d4iffaild4", 3);
    if( prob != 0.75 ) document.write(failstring);
}

function test_process_dice() {
    var failstring = "<br>process dice FAILED!";
    var prob = process_dice("1d2");
    if( prob[0] != 0 ) document.write(failstring);
    if( prob[1] != 0.5 ) document.write(failstring);
    if( prob[2] != 0.5 ) document.write(failstring);    

    var prob = process_dice("1d2where1is2");
    if( prob[0] != 0 ) document.write(failstring);
    if( prob[1] != 0 ) document.write(failstring);
    if( prob[2] != 1 ) document.write(failstring);

    var prob = process_dice("2d2where1is2");
    if( prob[0] != 0 ) document.write(failstring);
    if( prob[1] != 0 ) document.write(failstring);
    if( prob[2] != 0 ) document.write(failstring);    
    if( prob[3] != 0 ) document.write(failstring);    
    if( prob[4] != 1 ) document.write(failstring);    

    var prob = process_dice("1d4where1is2");
    if( prob[0] != 0 ) document.write(failstring);
    if( prob[1] != 0 ) document.write(failstring);
    if( prob[2] != 0.5 ) document.write(failstring);    
    if( prob[3] != 0.25 ) document.write(failstring);    
    if( prob[4] != 0.25 ) document.write(failstring);    

    var prob = process_dice("1d4where2is3where1is2");
    if( prob[0] != 0.0 ) document.write(failstring);
    if( prob[1] != 0.0 ) document.write(failstring);
    if( prob[2] != 0.25 ) document.write(failstring);    
    if( prob[3] != 0.5 ) document.write(failstring);    
    if( prob[4] != 0.25 ) document.write(failstring);    

}

function test_dice_cmf() {
    var failstring = "<br>cmf test FAILED!";
    var cmf = dice_roll_cmf("1d2");
    if( cmf[0] != 0 ) document.write(failstring);
    if( cmf[1] != 0.5 ) document.write(failstring);
    if( cmf[2] != 1.0 ) document.write(failstring);    
    
    
    var cmf = dice_roll_cmf("1d2where1is2");
    if( cmf[0] != 0 ) document.write(failstring);
    if( cmf[1] != 0 ) document.write(failstring);
    if( cmf[2] != 1 ) document.write(failstring);

    
    var cmf = process_dice("2d2where1is2");
    if( cmf[0] != 0 ) document.write(failstring);
    if( cmf[1] != 0 ) document.write(failstring);
    if( cmf[2] != 0 ) document.write(failstring);    
    if( cmf[3] != 0 ) document.write(failstring);    
    if( cmf[4] != 1 ) document.write(failstring);    

    var cmf = dice_roll_cmf("1d4where1is2");
    if( cmf[0] != 0 ) document.write(failstring);
    if( cmf[1] != 0 ) document.write(failstring);
    if( cmf[2] != 0.5 ) document.write(failstring);    
    if( cmf[3] != 0.75 ) document.write(failstring);    
    if( cmf[4] != 1.0 ) document.write(failstring);    

    var cmf = dice_roll_cmf("1d4where2is3where1is2");
    if( cmf[0] != 0.0 ) document.write(failstring);
    if( cmf[1] != 0.0 ) document.write(failstring);
    if( cmf[2] != 0.25 ) document.write(failstring);    
    if( cmf[3] != 0.75 ) document.write(failstring);    
    if( cmf[4] != 1.0 ) document.write(failstring);    

}

function test_is_number() {    
    var failstring = "<br>is number test FAILED!";
  
    if( is_number("2") != true ) document.write(failstring);
    if( is_number("3") != true ) document.write(failstring);
    if( is_number("-4") != false ) document.write(failstring);
    if( is_number("1.3") != false ) document.write(failstring);
    if( is_number("asf") != false ) document.write(failstring);

}


// run a bunch of tests to finish off
//test_modifyDice();
//test_modifiedDiceProbability();
//test_process_dice();
//test_iffail();
//test_dice_cmf();
//test_is_number();

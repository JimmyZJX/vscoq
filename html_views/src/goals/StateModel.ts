/// <reference path="../../typings/index.d.ts" />
/// <reference path="ui-util.ts" />
// import {makeElement, makeBreakingText, makeText, setChildren, onDoubleClickBreakableText} from './ui-util';


enum HypothesisDifference { None, Changed, New, MovedUp, MovedDown }
enum TextDifference { None, Added, Removed }
interface TextPartDifference {
  text: string;
  change: TextDifference;
}
interface Hypothesis {
  identifier: string;
  relation: string;
  expression: string;
  diffExpression?: TextPartDifference[];
  diff: HypothesisDifference;
}
interface Goal {
  id: number;
  hypotheses: Hypothesis[];
  goal: string|{string:string};
  diffGoal?: TextPartDifference[];
}
interface UnfocusedGoalStack {
  // subgoals that appear before the focus
  before: Goal[];
  // reference to the more-focused background goals
  next?: UnfocusedGoalStack
  // subgoals that appear after the focus
  after: Goal[];
}

interface FailValue {
  message: string;
  location?: Location;
}

interface CoqTopGoalResult {
  goals?: Goal[];
  backgroundGoals?: UnfocusedGoalStack,
  shelvedGoals?: Goal[],
  abandonedGoals?: Goal[],
  error?: FailValue;
}

enum DisplayState {
  Proof, Top, Error
}

function getDisplayState(state: CoqTopGoalResult) {
  if (state.error)
    return DisplayState.Error;
  if (state.goals || state.backgroundGoals || state.abandonedGoals || state.shelvedGoals)
    return DisplayState.Proof;
  else
    return DisplayState.Top;
}

function countUnfocusedGoals(u: UnfocusedGoalStack) {
  if(!u)
    return 0;
  return u.before.length + u.after.length + countUnfocusedGoals(u.next);
}

function countAllGoals(state: CoqTopGoalResult): number {
  const result =
    (state.goals ? state.goals.length : 0)
    + countUnfocusedGoals(state.backgroundGoals)
    + (state.abandonedGoals ? state.abandonedGoals.length : 0)
    + (state.shelvedGoals ? state.shelvedGoals.length : 0);
  return result;
}

function getDifferenceClass(diff: HypothesisDifference) {
  switch(diff) {
    case HypothesisDifference.Changed:
      return ' changed';
    case HypothesisDifference.New:
      return ' new';
    case HypothesisDifference.MovedUp:
      return ' movedUp';
    case HypothesisDifference.MovedDown:
      return ' movedDown';
    default:
      return '';
  }
}

function getTextDiffClass(diff: TextDifference) : string {
  switch(diff) {
    case TextDifference.Added: return 'charsAdded'
    case TextDifference.Removed: return 'charsRemoved'
    default: return ''
  }
}

function createDiffText(parts: TextPartDifference[]) : Node[] {
  return parts.map((part) =>
    $('<span>')
    .addClass(getTextDiffClass(part.change))
    .append(makeBreakingText(part.text))
    [0]
    );
}

function onDoubleClickBreakableText(event: JQueryMouseEventObject) {
  // toggleHideElement(event.fromElement)
  // (<Element>event.target).classList.toggle('breakText');
  var target = <Element>event.currentTarget;
  if($(event.currentTarget).hasClass('hypothesis')) {
    $(event.currentTarget).toggleClass('breakText');
    $(event.currentTarget).toggleClass('noBreakText');
  }
  // event.stopPropagation();
  // (<Element>event.target).classList.toggle('noBreakContainedText');
  // event.fromElement.appendChild(makeText('breakText')[0]);
}

function createHypothesis(hyp: Hypothesis) : JQuery {
  return $('<li>')
    .addClass('hypothesis')
    .addClass('breakText')
    .addClass(getDifferenceClass(hyp.diff))
    .append(
      [ $('<span>').addClass('ident').text(hyp.identifier)
      , $('<span>').addClass('rel').text(hyp.relation)
      , $('<span>').addClass('expr')
        // .append($(makeBreakingText(hyp.expression)))
        .append(hyp.diffExpression
            ? $(createDiffText(hyp.diffExpression))
            : $(makeBreakingText(hyp.expression)))
      ])
    // .append(createDiffText(hyp.diffExpression))
    .on('dblclick', onDoubleClickBreakableText)
  // var hypE = makeElement('li', {class: 'hypothesis breakText' + getDifferenceClass(hyp.diff)},
  //   [ makeElement('span',{class:'ident'},makeText(hyp.identifier))
  //   , makeElement('span',{class:'rel'},makeText(hyp.relation))
  //   , makeElement('span',{class:'expr'},
  //     hyp.diffExpression
  //     ? createDiffText(hyp.diffExpression)
  //     : makeBreakingText(hyp.expression))
  //   ]);
  // hypE.ondblclick = onDoubleClickBreakableText;
  // return hypE;
}

function createHypotheses(hyps: Hypothesis[]) {
  return $('<ul>')
    .addClass('hypotheses')
    .append(hyps.map((hyp) => createHypothesis(hyp)));
  // return makeElement('ul',{class:"hypotheses"},
  //   hyps.map((hyp) => {
  //     return createHypothesis(hyp);
  //   }));
}

function createGoal(goal: Goal, idx:number, count:number) {
  let expr = $('<span>').addClass('expr');
  if(goal.diffGoal)
    expr.append(createDiffText(goal.diffGoal))
  else if(typeof goal.goal === 'string')
    expr.text(goal.goal)
  else
    expr.text((<{string:string}>goal.goal).string)
  return $('<li>')
    .addClass('goal')
    .append(
      [ $('<span>').addClass('goalId').text(`${idx+1}/${count}`)
      , $('<span>').addClass('error')
      , expr
      ]);
  // return makeElement('li', {class:"goal"},
  //   [ makeElement('span',{class: 'goalId'},makeText(`${idx+1}/${count}`))
  //   , makeElement('span',{class: 'error'},[])
  //   , makeElement('span',{class: 'expr'},
  //     goal.diffGoal
  //     ? createDiffText(goal.diffGoal)
  //     : typeof goal.goal === 'string'
  //     ? makeText(<string>goal.goal)
  //     : makeText((<{string:string}>goal.goal).string))
  //   ]);
}

function createGoals(goals: Goal[]) {
  return $('<ul>')
    .addClass('goalsLists')
    .append(goals.map((g,i) => createGoal(g,i,goals.length)));
  // return makeElement('ul',{class:"goalsList"}, goals.map((g,i) => createGoal(g,i,goals.length)));
}

class StateModel {
  private static hypothesesNodeClass = '.hypotheses';
  private static goalNodeClass = '.goal';
  private static focusedStateClass = '.focusedState';
  // private statesE = $('#states');
  private focusedState = 0;
  private coqState : CoqTopGoalResult;

  constructor() {
  }


  private setMessage(message: string) {
    $('#messages').text(message);
  }

  private setErrorMessage(message: string) {
    $('.error').text(message);
    // const errorsN = this.getCurrentGoalE().getElementsByClassName('error');
    // if(errorsN.length > 0)
    // setChildren(errorsN.item(0), makeText(message));
    // document.getElementById('messages').innerHTML = message;
    // setChildren(document.getElementById('messages'), [makeElement('span',{class:'error'},[makeText(message)])]);
  }
  private clearErrorMessage() {
    $('.error').empty();
    // const errorsN = this.getCurrentGoalE().getElementsByClassName('error');
    // if(errorsN.length > 0)
    //   setChildren(errorsN.item(0), []);
  }

  public updateState(state: CoqTopGoalResult) {
    try {
      this.focusedState = 0;
      this.clearErrorMessage();
      $('#stdout').text('');
      // clearChildren(document.getElementById('messages'));
      // var x = document.getElementById('states');
      // while(x.hasChildNodes)
      //   x.removeChild(x.lastChild);
      // // $(x).empty();
      //   // $('#states').children().empty();
      //     this.setMessage("AAAAAAAA");

      if(state.error)
        this.setErrorMessage(state.error.message.toString());
      if (countAllGoals(state) == 0) {
        $('#states').empty();
        this.setMessage("No more subgoals.");
      } else if (state.goals) {
        if(state.goals.length > 0) {
          this.setMessage("");
          $('#states')
          .empty()
          .append(state.goals.map((hp,idx) =>
            $('<div>')
              .addClass(StateModel.focusedStateClass)
              .addClass(this.focusedState===idx ? "visible" : "hidden")
              .append(
                [ createHypotheses(state.goals[idx].hypotheses)
                , createGoal(state.goals[idx], idx, state.goals.length) ])
                ))
        } else {
          $('#states').empty();
          this.setMessage("There are unfocused goals.");
        }
      }
    } catch(err) {
      this.setMessage(err);
    }
  }
}
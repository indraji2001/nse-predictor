import modelData from './model.json'

interface TreeNode {
  split_feature?: number
  threshold?: number
  default_left?: boolean
  left_child?: TreeNode
  right_child?: TreeNode
  leaf_value?: number
}

function evaluateNode(node: TreeNode, features: number[]): number {
  if (node.leaf_value !== undefined) {
    return node.leaf_value
  }

  const val = features[node.split_feature!]
  const isMissing = val === undefined || val === null || isNaN(val)

  if (isMissing) {
    if (node.default_left) {
      return evaluateNode(node.left_child!, features)
    } else {
      return evaluateNode(node.right_child!, features)
    }
  }

  if (val <= node.threshold!) {
    return evaluateNode(node.left_child!, features)
  } else {
    return evaluateNode(node.right_child!, features)
  }
}

/**
 * Predicts the probability of a stock gaining >= 5% in the next 10 trading days.
 * Features must match the training features in this exact order:
 * 0: rsi14
 * 1: macd
 * 2: macdSignal
 * 3: macdHist
 * 4: adx
 * 5: bbPercentB
 * 6: bbBandwidth
 * 7: volumeRatio
 * 8: ret5d
 * 9: ret20d
 * 10: ret50d
 * 11: distFrom200
 * 
 * @param features Array of 12 computed indicator features
 * @returns Probability as a percentage (0 to 100)
 */
export function predictProbability(features: number[]): number {
  let sum = 0
  const trees = modelData.tree_info as any[]
  
  for (const tree of trees) {
    sum += evaluateNode(tree.tree_structure, features)
  }
  
  // Sigmoid activation function for binary classification: 1 / (1 + exp(-x))
  const prob = 1 / (1 + Math.exp(-sum))
  return +(prob * 100).toFixed(1)
}
